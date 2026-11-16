// NoteBoard 关系图谱画布
// Canvas 绘制力导向图：滚轮 / 双指缩放、拖动空白处平移、拖动节点调整布局、悬停高亮相邻笔记、单击打开笔记。
// 颜色全部取自主题变量，切换主题后立即重绘；布局在数据刷新时沿用已有节点位置，不会整体跳动。

import { useCallback, useEffect, useRef } from 'react';
import type { ForceSimulation, SimNode } from './graphLayout';
import {
  clamp,
  DRAG_THRESHOLD,
  drawGraph,
  fitTransform,
  hitTest,
  LABEL_SIZE,
  MAX_SCALE,
  MIN_SCALE,
  PRERUN_BUDGET_MS,
  prepareGraph,
  readPalette,
  truncateLabel,
  type Gesture,
  type Palette,
  type Transform,
} from './linkGraphRender';
import { LinkGraphControls } from './LinkGraphControls';
import type { GraphNode, LinkGraph } from './linkGraph';

interface LinkGraphViewProps {
  graph: LinkGraph;
  /** 当前文档对应的节点（以强调色突出） */
  focusId: string | null;
  onOpenNode: (node: GraphNode) => void;
  /** panel：侧栏局部图；full：全屏图谱 */
  variant: 'panel' | 'full';
}

export function LinkGraphView({ graph, focusId, onOpenNode, variant }: LinkGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);

  // 渲染循环与交互状态都放在 ref 中：高频变化不触发 React 重渲染
  const simRef = useRef<ForceSimulation | null>(null);
  const signatureRef = useRef('');
  const metaRef = useRef(new Map<string, GraphNode>());
  const neighborsRef = useRef(new Map<string, Set<string>>());
  /** 各节点标签的半宽（屏幕像素），适应视图时避免标签被裁掉 */
  const labelHalfRef = useRef(new Map<string, number>());
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  /** 未被用户平移 / 缩放前自动适应视图 */
  const autoFitRef = useRef(true);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const paletteRef = useRef<Palette | null>(null);
  const hoverRef = useRef<string | null>(null);
  const gestureRef = useRef<Gesture>({ type: 'none' });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const frameRef = useRef(0);
  const focusRef = useRef(focusId);
  const onOpenRef = useRef(onOpenNode);
  focusRef.current = focusId;
  onOpenRef.current = onOpenNode;

  const computeFit = useCallback(() => {
    const sim = simRef.current;
    return sim ? fitTransform(sim, sizeRef.current, metaRef.current, labelHalfRef.current, variant) : null;
  }, [variant]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    const palette = paletteRef.current;
    if (!canvas || !sim || !palette) return;
    drawGraph({
      canvas,
      sim,
      palette,
      size: sizeRef.current,
      transform: transformRef.current,
      meta: metaRef.current,
      neighbors: neighborsRef.current,
      hover: hoverRef.current,
      focus: focusRef.current,
      variant,
    });
  }, [variant]);

  const hitNode = (x: number, y: number) => {
    const sim = simRef.current;
    return sim ? hitTest(x, y, sim, metaRef.current, transformRef.current) : null;
  };

  /** 屏幕坐标 → 世界坐标 */

  /** 下一帧：推进布局、自动适应视图并重绘；仍有运动时继续循环 */
  const schedule = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const sim = simRef.current;
      let keepGoing = false;
      if (sim?.active) {
        sim.tick();
        keepGoing = true;
      }
      if (autoFitRef.current) {
        const target = computeFit();
        if (target) {
          // 平滑逼近目标，避免布局抖动时视图跟着跳
          const current = transformRef.current;
          const ease = 0.2;
          const next = {
            x: current.x + (target.x - current.x) * ease,
            y: current.y + (target.y - current.y) * ease,
            k: current.k + (target.k - current.k) * ease,
          };
          transformRef.current = next;
          if (Math.abs(target.k - next.k) > 0.002 || Math.abs(target.x - next.x) > 0.5 || Math.abs(target.y - next.y) > 0.5) {
            keepGoing = true;
          }
        }
      }
      draw();
      if (keepGoing) schedule();
    });
  }, [draw, fitTransform]);

  // 数据变化：重建布局（沿用已有节点位置），结构未变时只更新节点信息
  useEffect(() => {
    const prepared = prepareGraph(graph, simRef.current, paletteRef.current?.font ?? 'sans-serif');
    metaRef.current = new Map(graph.nodes.map((node) => [node.id, node]));
    neighborsRef.current = prepared.neighbors;
    labelHalfRef.current = prepared.labelHalf;
    const previousSim = simRef.current;
    if (prepared.signature === signatureRef.current && previousSim) {
      schedule();
      return;
    }
    signatureRef.current = prepared.signature;
    simRef.current = prepared.sim;
    hoverRef.current = null;
    autoFitRef.current = true;
    if (!previousSim) {
      // 首次布局：同步预演一段时间，打开时直接呈现大致成形的图
      const startedAt = performance.now();
      while (prepared.sim.active && performance.now() - startedAt < PRERUN_BUDGET_MS) prepared.sim.tick();
      const fit = computeFit();
      if (fit) transformRef.current = fit;
    } else {
      // 数据刷新：温和地重新加热，已有节点基本保持原位
      prepared.sim.alpha = 0.5;
    }
    schedule();
  }, [graph, computeFit, schedule]);

  // 当前文档变化（全屏图谱切换笔记）后重绘高亮
  useEffect(() => {
    schedule();
  }, [focusId, schedule]);

  // 尺寸跟随容器（含设备像素比）
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      // 首次拿到尺寸时直接对齐视图
      if (autoFitRef.current) {
        const fit = computeFit();
        if (fit) transformRef.current = fit;
      }
      schedule();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitTransform, schedule]);

  // 主题：读取一次，并在 data-theme / 内联变量变化时重新读取
  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const refresh = () => {
      paletteRef.current = readPalette(probe);
      schedule();
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    return () => observer.disconnect();
  }, [schedule]);

  // 卸载时停止动画
  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  }, []);


  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  /** 以屏幕上的某点为中心缩放 */
  const zoomAt = useCallback((screenX: number, screenY: number, nextK: number, origin = transformRef.current) => {
    const k = clamp(nextK, MIN_SCALE, MAX_SCALE);
    const worldX = (screenX - origin.x) / origin.k;
    const worldY = (screenY - origin.y) / origin.k;
    transformRef.current = { k, x: screenX - worldX * k, y: screenY - worldY * k };
    autoFitRef.current = false;
    schedule();
  }, [schedule]);

  const setHover = (id: string | null) => {
    if (hoverRef.current === id) return;
    hoverRef.current = id;
    if (canvasRef.current) canvasRef.current.style.cursor = id ? 'pointer' : 'grab';
    schedule();
  };

  // 滚轮缩放需要非被动监听才能阻止页面滚动
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = localPoint(event);
      // 触控板双指滑动（无 ctrl）较细腻，鼠标滚轮单格约 100
      const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
      zoomAt(point.x, point.y, transformRef.current.k * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const releaseNode = (node: SimNode) => {
    node.fx = null;
    node.fy = null;
    if (simRef.current) simRef.current.alphaTarget = 0;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 2) {
      // 第二根手指落下：转为双指缩放，放开正在拖动的节点
      const gesture = gestureRef.current;
      if (gesture.type === 'node') releaseNode(gesture.node);
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        origin: { ...transformRef.current },
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
      return;
    }
    if (pointersRef.current.size > 2) return;

    const node = hitNode(point.x, point.y);
    if (node) {
      gestureRef.current = { type: 'node', node, startX: point.x, startY: point.y, moved: false };
      if (event.pointerType !== 'mouse') setHover(node.id);
    } else {
      gestureRef.current = { type: 'pan', startX: point.x, startY: point.y, origin: { ...transformRef.current }, moved: false };
      canvas.style.cursor = 'grabbing';
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;

    if (gesture.type === 'none') {
      // 仅鼠标悬停时高亮
      if (event.pointerType === 'mouse') setHover(hitNode(point.x, point.y)?.id ?? null);
      return;
    }
    if (gesture.type === 'pinch') {
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      // 先按缩放比例绕起始中点缩放，再叠加中点的平移
      const { origin } = gesture;
      const k = clamp(origin.k * (distance / gesture.distance), MIN_SCALE, MAX_SCALE);
      const worldX = (gesture.midX - origin.x) / origin.k;
      const worldY = (gesture.midY - origin.y) / origin.k;
      transformRef.current = { k, x: midX - worldX * k, y: midY - worldY * k };
      autoFitRef.current = false;
      schedule();
      return;
    }
    const moved = Math.hypot(point.x - gesture.startX, point.y - gesture.startY) > DRAG_THRESHOLD;
    if (gesture.type === 'pan') {
      if (!gesture.moved && !moved) return;
      gesture.moved = true;
      transformRef.current = {
        k: gesture.origin.k,
        x: gesture.origin.x + point.x - gesture.startX,
        y: gesture.origin.y + point.y - gesture.startY,
      };
      autoFitRef.current = false;
      schedule();
      return;
    }
    // 拖动节点：超过阈值后才固定节点并加热布局，单击不会扰动布局
    if (!gesture.moved && !moved) return;
    if (!gesture.moved) {
      gesture.moved = true;
      autoFitRef.current = false;
      if (simRef.current) {
        simRef.current.alphaTarget = 0.25;
        simRef.current.reheat(0.25);
      }
      setHover(gesture.node.id);
    }
    const transform = transformRef.current;
    const world = { x: (point.x - transform.x) / transform.k, y: (point.y - transform.y) / transform.k };
    gesture.node.fx = world.x;
    gesture.node.fy = world.y;
    schedule();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    const gesture = gestureRef.current;
    const canvas = canvasRef.current!;

    if (gesture.type === 'pinch') {
      // 抬起一根手指后用剩下的手指继续平移
      const rest = [...pointersRef.current.values()][0];
      gestureRef.current = rest
        ? { type: 'pan', startX: rest.x, startY: rest.y, origin: { ...transformRef.current }, moved: true }
        : { type: 'none' };
      return;
    }
    if (pointersRef.current.size > 0) return;
    gestureRef.current = { type: 'none' };

    if (gesture.type === 'node') {
      releaseNode(gesture.node);
      if (event.type === 'pointerup' && !gesture.moved) {
        const info = metaRef.current.get(gesture.node.id);
        if (info) {
          // 打开笔记：移除面板保留标记，让移动端大纲面板随之收起（click 在 pointerup 之后派发）
          canvas.removeAttribute('data-sheet-keep');
          window.setTimeout(() => canvas.setAttribute('data-sheet-keep', ''), 0);
          onOpenRef.current(info);
        }
      }
      if (event.pointerType !== 'mouse') setHover(null);
      schedule();
    }
    canvas.style.cursor = hoverRef.current ? 'pointer' : 'grab';
  };

  const zoomBy = (factor: number) => {
    const { width, height } = sizeRef.current;
    zoomAt(width / 2, height / 2, transformRef.current.k * factor);
  };

  return (
    <div ref={containerRef} className={`nb-graph-view is-${variant}`}>
      {/* 探针：读取主题变量的计算值与界面字体 */}
      <span ref={probeRef} className="nb-graph-probe" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="nb-graph-canvas"
        data-sheet-keep=""
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse' && gestureRef.current.type === 'none') setHover(null);
        }}
      />
      <LinkGraphControls
        onZoom={zoomBy}
        onFit={() => {
          autoFitRef.current = true;
          schedule();
        }}
      />
    </div>
  );
}
