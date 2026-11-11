// NoteBoard 思维导图展示主题（布局 / 配色 / 连线样式）
// 配色以「一级分支循环取色」为核心，节点卡片背景由分支色按比例混入表面色，
// 从而在浅色 / 深色全局主题下都能保持良好对比度。
// 详见 docs/09-开发路线图.md

import type { MindmapEdgeStyle, MindmapLayout } from './mindmapTypes';

export interface MindmapTheme {
  id: string;
  name: string;
  /** 一级分支与连线循环使用的配色 */
  branchColors: string[];
  /** 根节点背景 */
  rootBackground: string;
  /** 根节点文字颜色 */
  rootText: string;
  /** 根节点投影 */
  rootShadow: string;
  /** 连线样式 */
  edgeStyle: MindmapEdgeStyle;
  /** 连线不透明度 */
  edgeOpacity: number;
  /** 非根节点卡片背景混入分支色的百分比 (0 = 纯表面色) */
  nodeTint: number;
}

export const MINDMAP_THEMES: MindmapTheme[] = [
  {
    id: 'classic',
    name: '经典蓝',
    branchColors: ['var(--nb-blue-500)', 'var(--nb-emerald-500)', 'var(--nb-amber-500)', 'var(--nb-purple-500)', 'var(--nb-pink-500)', 'var(--nb-cyan-500)'],
    rootBackground: 'var(--editor-accent)',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-3b82f6-a35)',
    edgeStyle: 'curve',
    edgeOpacity: 0.8,
    nodeTint: 0,
  },
  {
    id: 'ocean',
    name: '深海',
    branchColors: ['var(--nb-auto-0284c7)', 'var(--nb-cyan-500)', 'var(--nb-teal-500)', 'var(--nb-blue-600)', 'var(--nb-auto-0ea5e9)', 'var(--nb-cyan-600)'],
    rootBackground: 'linear-gradient(135deg, var(--nb-auto-0ea5e9), var(--nb-auto-0369a1))',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-0284c7-a40)',
    edgeStyle: 'curve',
    edgeOpacity: 0.9,
    nodeTint: 9,
  },
  {
    id: 'sunset',
    name: '暖阳',
    branchColors: ['var(--nb-orange-600)', 'var(--nb-red-500)', 'var(--nb-pink-500)', 'var(--nb-amber-500)', 'var(--nb-auto-e11d48)', 'var(--nb-orange-400)'],
    rootBackground: 'linear-gradient(135deg, var(--nb-orange-500), var(--nb-pink-600))',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-ea580c-a40)',
    edgeStyle: 'curve',
    edgeOpacity: 0.9,
    nodeTint: 9,
  },
  {
    id: 'forest',
    name: '森林',
    branchColors: ['var(--nb-green-600)', 'var(--nb-auto-65a30d)', 'var(--nb-teal-600)', 'var(--nb-green-500)', 'var(--nb-auto-84cc16)', 'var(--nb-teal-500)'],
    rootBackground: 'linear-gradient(135deg, var(--nb-green-500), var(--nb-green-700))',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-16a34a-a40)',
    edgeStyle: 'curve',
    edgeOpacity: 0.9,
    nodeTint: 9,
  },
  {
    id: 'violet',
    name: '幻紫',
    branchColors: ['var(--nb-purple-600)', 'var(--nb-auto-a855f7)', 'var(--nb-auto-d946ef)', 'var(--nb-violet-500)', 'var(--nb-auto-c026d3)', 'var(--nb-purple-500)'],
    rootBackground: 'linear-gradient(135deg, var(--nb-purple-500), var(--nb-auto-6d28d9))',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-7c3aed-a42)',
    edgeStyle: 'curve',
    edgeOpacity: 0.9,
    nodeTint: 10,
  },
  {
    id: 'candy',
    name: '马卡龙',
    branchColors: ['var(--nb-pink-400)', 'var(--nb-purple-400)', 'var(--nb-blue-400)', 'var(--nb-auto-34d399)', 'var(--diff-modify-border)', 'var(--nb-orange-400)'],
    rootBackground: 'linear-gradient(135deg, var(--nb-purple-400), var(--nb-blue-400))',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-8b5cf6-a38)',
    edgeStyle: 'curve',
    edgeOpacity: 0.95,
    nodeTint: 14,
  },
  {
    id: 'mono',
    name: '墨线',
    branchColors: ['var(--nb-slate-600)', 'var(--nb-slate-500)', 'var(--nb-slate-700)', 'var(--nb-slate-400)', 'var(--nb-slate-800)', 'var(--nb-auto-7c8ba1)'],
    rootBackground: 'linear-gradient(135deg, var(--nb-slate-700), var(--nb-slate-900))',
    rootText: 'var(--nb-white)',
    rootShadow: '0 var(--dim-6) var(--dim-16) var(--nb-auto-0f172a-a40)',
    edgeStyle: 'straight',
    edgeOpacity: 0.75,
    nodeTint: 0,
  },
];

export const DEFAULT_MINDMAP_THEME_ID = MINDMAP_THEMES[0].id;

/** 按 id 取主题，未命中时回退首个主题 */
export function getMindmapTheme(id?: string): MindmapTheme {
  return MINDMAP_THEMES.find((t) => t.id === id) ?? MINDMAP_THEMES[0];
}

export interface MindmapLayoutMeta {
  id: MindmapLayout;
  name: string;
  description: string;
}

export const MINDMAP_LAYOUTS: MindmapLayoutMeta[] = [
  { id: 'right', name: '向右逻辑图', description: '所有子节点统一向右展开' },
  { id: 'left', name: '向左逻辑图', description: '所有子节点统一向左展开' },
  { id: 'balanced', name: '双向平衡图', description: '一级分支左右交替分布，更紧凑' },
  { id: 'tree', name: '向下组织图', description: '自顶向下的层级组织结构' },
  { id: 'tree-up', name: '向上组织图', description: '自底向上的层级组织结构' },
  { id: 'indent-right', name: '右侧树状图', description: '子节点在下方向右缩进排列' },
  { id: 'indent-left', name: '左侧树状图', description: '子节点在下方向左缩进排列' },
  { id: 'timeline', name: '时间轴', description: '一级分支沿主轴依次排开' },
  { id: 'fishbone', name: '鱼骨图', description: '分支沿脊柱上下交替展开' },
];

export const DEFAULT_MINDMAP_LAYOUT: MindmapLayout = 'right';

/** 连线样式选项（undefined 表示跟随配色主题） */
export const MINDMAP_EDGE_STYLES: Array<{ id: MindmapEdgeStyle; name: string }> = [
  { id: 'curve', name: '曲线' },
  { id: 'straight', name: '直线' },
  { id: 'elbow', name: '折线' },
];

/** 按 id 取布局描述，未命中时回退首个布局 */
export function getMindmapLayoutMeta(id: MindmapLayout): MindmapLayoutMeta {
  return MINDMAP_LAYOUTS.find((l) => l.id === id) ?? MINDMAP_LAYOUTS[0];
}
