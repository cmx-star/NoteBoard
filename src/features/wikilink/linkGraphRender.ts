// 关系图谱 Canvas 绘制与几何计算：主题取色、视图适配、节点绘制与命中检测
// 纯函数不依赖 React，便于在面板与全屏两种视图间复用。

import { ForceSimulation, seedPositions, type SimLink, type SimNode } from './graphLayout';
import type { GraphNode, LinkGraph } from './linkGraph';

/** 主题调色板（已解析为画布可用的颜色） */
export interface Palette {
  text: string;
  muted: string;
  accent: string;
  link: string;
  border: string;
  surface: string;
  font: string;
}

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface GraphSize {
  width: number;
  height: number;
  dpr: number;
}

export const MIN_SCALE = 0.08;
export const MAX_SCALE = 6;
/** 判定为拖动而非点击的移动距离（像素） */
export const DRAG_THRESHOLD = 4;
/** 首次布局时同步预演的时间预算：打开即呈现大致成形的图，而不是从一团散开 */
export const PRERUN_BUDGET_MS = 60;
/** 标签字号（屏幕像素，不随缩放变化） */
export const LABEL_SIZE = 11;
/** 标签最长显示字数 */
export const LABEL_MAX_CHARS = 18;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 节点半径（世界坐标）：相连笔记越多越大 */
export function radiusOf(node: GraphNode | undefined): number {
  return 4 + Math.min(9, Math.sqrt(node?.degree ?? 0) * 1.7);
}

/** 把任意 CSS 颜色转成画布一定能识别的 rgba（主题可能使用 color-mix 等写法） */
export function normalizeColor(value: string, fallback: string): string {
  if (!value) return fallback;
  if (/^(#|rgb)/i.test(value)) return value;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return fallback;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return fallback;
  }
}

/** 通过探针元素读取主题变量的计算值 */
export function readPalette(probe: HTMLElement): Palette {
  const read = (variable: string, fallback: string) => {
    probe.style.color = `var(${variable}, ${fallback})`;
    return normalizeColor(getComputedStyle(probe).color, fallback);
  };
  return {
    text: read('--editor-text', '#333333'),
    muted: read('--editor-text-muted', '#94a3b8'),
    accent: read('--accent-strong', '#3b82f6'),
    link: read('--editor-link', '#2563eb'),
    border: read('--editor-border', '#e5e7eb'),
    surface: read('--editor-surface', '#ffffff'),
    font: getComputedStyle(probe).fontFamily || 'sans-serif',
  };
}

export function truncateLabel(name: string): string {
  return name.length > LABEL_MAX_CHARS ? `${name.slice(0, LABEL_MAX_CHARS - 1)}…` : name;
}

/** 图结构签名：节点与边都没变时刷新数据不重新加热布局 */
export function graphSignature(graph: LinkGraph): string {
  return `${graph.nodes.map((node) => node.id).join('\n')}\n--\n${graph.edges.map((edge) => `${edge.source}>${edge.target}`).join('\n')}`;
}

/** 指针手势状态 */
export type Gesture =
  | { type: 'none' }
  | { type: 'pan'; startX: number; startY: number; origin: Transform; moved: boolean }
  | { type: 'node'; node: SimNode; startX: number; startY: number; moved: boolean }
  | { type: 'pinch'; distance: number; origin: Transform; midX: number; midY: number };

export interface PreparedGraph {
  sim: ForceSimulation;
  neighbors: Map<string, Set<string>>;
  labelHalf: Map<string, number>;
  signature: string;
}

/** 依据图数据建立邻接表、量取标签宽度并生成力导向模拟（沿用已存在节点的位置） */
export function prepareGraph(graph: LinkGraph, previousSim: ForceSimulation | null, font: string): PreparedGraph {
  const neighbors = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set());
    if (!neighbors.has(edge.target)) neighbors.set(edge.target, new Set());
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }
  // 量取标签宽度（字体在主题读取前未知时退回无衬线字体，误差可忽略）
  const measure = document.createElement('canvas').getContext('2d');
  const labelHalf = new Map<string, number>();
  if (measure) {
    measure.font = `${LABEL_SIZE}px ${font}`;
    for (const node of graph.nodes) labelHalf.set(node.id, measure.measureText(truncateLabel(node.name)).width / 2 + 2);
  }
  const previous = new Map((previousSim?.nodes ?? []).map((node) => [node.id, { x: node.x, y: node.y }]));
  const positions = seedPositions(
    graph.nodes.map((node) => node.id),
    (id) => [...(neighbors.get(id) ?? [])],
    previous,
  );
  const nodes: SimNode[] = graph.nodes.map((node) => {
    const position = positions.get(node.id)!;
    return { id: node.id, x: position.x, y: position.y, vx: 0, vy: 0, fx: null, fy: null };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: SimLink[] = graph.edges
    .map((edge) => ({ source: byId.get(edge.source)!, target: byId.get(edge.target)! }))
    .filter((link) => link.source && link.target);
  return {
    sim: new ForceSimulation(nodes, links),
    neighbors,
    labelHalf,
    signature: graphSignature(graph),
  };
}

/** 计算能容纳全部节点及其标签的视图变换（标签是屏幕固定尺寸，需迭代求缩放） */
export function fitTransform(
  sim: ForceSimulation,
  size: GraphSize,
  meta: Map<string, GraphNode>,
  labelHalf: Map<string, number>,
  variant: string,
): Transform | null {
  const { width, height } = size;
  if (sim.nodes.length === 0 || width === 0 || height === 0) return null;
  const padding = variant === 'full' ? 40 : 12;
  const availableW = Math.max(width - padding * 2, 1);
  const availableH = Math.max(height - padding * 2, 1);
  /** 给定缩放下内容在屏幕上的范围 */
  const extents = (k: number) => {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const node of sim.nodes) {
      const r = radiusOf(meta.get(node.id)) * k;
      const half = Math.max(r, labelHalf.get(node.id) ?? 0);
      left = Math.min(left, node.x * k - half);
      right = Math.max(right, node.x * k + half);
      top = Math.min(top, node.y * k - r);
      // 标签在节点下方
      bottom = Math.max(bottom, node.y * k + r + LABEL_SIZE + 6);
    }
    return { left, right, top, bottom };
  };
  // 节点很少时不要放得过大
  let k = variant === 'full' ? 2.2 : 1.8;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const box = extents(k);
    const scale = Math.min(availableW / Math.max(box.right - box.left, 1), availableH / Math.max(box.bottom - box.top, 1));
    if (scale >= 0.995) break;
    k = Math.max(MIN_SCALE, k * scale);
    if (k === MIN_SCALE) break;
  }
  const box = extents(k);
  return { k, x: width / 2 - (box.left + box.right) / 2, y: height / 2 - (box.top + box.bottom) / 2 };
}

export interface DrawGraphOptions {
  canvas: HTMLCanvasElement;
  sim: ForceSimulation;
  palette: Palette;
  size: GraphSize;
  transform: Transform;
  meta: Map<string, GraphNode>;
  neighbors: Map<string, Set<string>>;
  hover: string | null;
  focus: string | null;
  variant: string;
}

export function drawGraph(options: DrawGraphOptions): void {
  const { canvas, sim, palette, size, transform, meta, neighbors, hover, focus, variant } = options;
  const { width, height, dpr } = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  const { x: tx, y: ty, k } = transform;
  const related = hover ? neighbors.get(hover) ?? new Set<string>() : null;
  const isActive = (id: string) => !hover || id === hover || related!.has(id);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  // ── 边（世界坐标，线宽保持 1 像素） ──
  context.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);
  context.lineWidth = 1 / k;
  context.strokeStyle = palette.muted;
  context.globalAlpha = hover ? 0.1 : 0.4;
  context.beginPath();
  const highlighted = [];
  for (const link of sim.links) {
    if (hover && (link.source.id === hover || link.target.id === hover)) {
      highlighted.push(link);
      continue;
    }
    context.moveTo(link.source.x, link.source.y);
    context.lineTo(link.target.x, link.target.y);
  }
  context.stroke();
  if (highlighted.length > 0) {
    context.globalAlpha = 0.95;
    context.strokeStyle = palette.accent;
    context.lineWidth = 1.6 / k;
    context.beginPath();
    for (const link of highlighted) {
      context.moveTo(link.source.x, link.source.y);
      context.lineTo(link.target.x, link.target.y);
    }
    context.stroke();
  }

  // ── 节点 ──
  for (const node of sim.nodes) {
    const info = meta.get(node.id);
    const r = radiusOf(info) + (node.id === focus ? 1.5 : 0);
    context.globalAlpha = isActive(node.id) ? 1 : 0.22;
    context.beginPath();
    if (info?.kind === 'file') {
      // 附件（画板、思维导图等）画成圆角方块：部分主题的链接色与强调色接近，靠形状区分
      const side = r * 1.7;
      // 较老的 WebKit（Linux / 旧版 macOS）没有 roundRect，退回直角方块
      if (typeof context.roundRect === 'function') context.roundRect(node.x - side / 2, node.y - side / 2, side, side, side * 0.28);
      else context.rect(node.x - side / 2, node.y - side / 2, side, side);
    } else {
      context.arc(node.x, node.y, r, 0, Math.PI * 2);
    }
    if (info?.kind === 'unresolved') {
      // 未创建的笔记：空心虚线圈
      context.fillStyle = palette.surface;
      context.fill();
      context.setLineDash([2 / k, 2 / k]);
      context.lineWidth = 1.2 / k;
      context.strokeStyle = palette.muted;
      context.stroke();
      context.setLineDash([]);
      continue;
    }
    context.fillStyle = node.id === focus || node.id === hover
      ? palette.accent
      : info?.kind === 'file'
        ? palette.link
        : palette.muted;
    context.fill();
    if (node.id === focus) {
      // 当前笔记外加一圈描边
      context.lineWidth = 2 / k;
      context.strokeStyle = palette.surface;
      context.stroke();
      context.beginPath();
      context.arc(node.x, node.y, r + 2.5 / k, 0, Math.PI * 2);
      context.lineWidth = 1.2 / k;
      context.strokeStyle = palette.accent;
      context.stroke();
    }
  }

  // ── 标签（屏幕坐标，字号不随缩放变化） ──
  const threshold = variant === 'full' ? 1.15 : 1;
  const fewNodes = sim.nodes.length <= (variant === 'full' ? 40 : 24);
  const zoomAlpha = fewNodes ? 1 : clamp((k - (threshold - 0.35)) / 0.35, 0, 1);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.font = `${LABEL_SIZE}px ${palette.font}`;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = palette.surface;
  for (const node of sim.nodes) {
    const important = node.id === focus || node.id === hover || Boolean(related?.has(node.id));
    let alpha = important ? 1 : zoomAlpha;
    if (hover && !important) alpha *= 0.25;
    if (alpha <= 0.02) continue;
    const info = meta.get(node.id);
    const sx = node.x * k + tx;
    const sy = node.y * k + ty + (radiusOf(info) + 2) * k + 2;
    // 画布外的标签跳过
    if (sx < -80 || sx > width + 80 || sy < -20 || sy > height + 20) continue;
    const label = truncateLabel(info?.name ?? '');
    context.globalAlpha = alpha;
    context.strokeText(label, sx, sy);
    context.fillStyle = node.id === focus || node.id === hover ? palette.accent : info?.kind === 'unresolved' ? palette.muted : palette.text;
    context.fillText(label, sx, sy);
  }
  context.globalAlpha = 1;
}

/** 屏幕坐标（相对画布）命中节点；返回最上层命中的节点 */
export function hitTest(
  screenX: number,
  screenY: number,
  sim: ForceSimulation,
  meta: Map<string, GraphNode>,
  transform: Transform,
): SimNode | null {
  const { x, y, k } = transform;
  const worldX = (screenX - x) / k;
  const worldY = (screenY - y) / k;
  for (let index = sim.nodes.length - 1; index >= 0; index -= 1) {
    const node = sim.nodes[index];
    // 触控与小节点放宽命中范围（至少约 8 个屏幕像素）
    const r = Math.max(radiusOf(meta.get(node.id)) + 2 / k, 8 / k);
    const dx = node.x - worldX;
    const dy = node.y - worldY;
    if (dx * dx + dy * dy <= r * r) return node;
  }
  return null;
}
