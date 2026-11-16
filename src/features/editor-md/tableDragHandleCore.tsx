// 表格行 / 列拖动把手的常量、几何测量与样式注入原语
import type { ResolvedPos } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { CellSelection } from '@tiptap/pm/tables';
import { isTableReorderable, type TableAxis } from './tableReorder';

/** 超过此位移才进入拖动，避免单击把手时误触排序 */
export const DRAG_START_DISTANCE = 4;
/** 落位动画时长，需与 tableDragHandle.css 中的过渡时长一致 */
export const SETTLE_DURATION = 240;
/** 指针离开单元格后把手的保留时间，便于移到把手上 */
export const HIDE_DELAY = 160;
/** 拖动行时靠近滚动视口上下边缘的自动滚动热区与最大步长 */
export const AUTO_SCROLL_EDGE = 48;
export const AUTO_SCROLL_MAX_STEP = 12;

/** 把手指向的单元格：表格位置与行列号 */
export interface CellTarget {
  tablePos: number;
  row: number;
  col: number;
}

/** 滚动内容坐标系下的矩形（与把手同一坐标系） */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HandleLayout {
  target: CellTarget;
  row: { x: number; y: number };
  /** 列中心滚出表格横向可视区时不显示列把手 */
  column: { x: number; y: number } | null;
  rowBox: Box;
  columnBox: Box;
}

/** 沿拖动方向的一段区间（行的上下沿 / 列的左右沿） */
export interface Segment {
  start: number;
  end: number;
}

export interface DragSession {
  axis: TableAxis;
  tablePos: number;
  index: number;
  pointerId: number;
  handle: HTMLElement;
  scrollParent: HTMLElement;
  startClientX: number;
  startClientY: number;
  /** 按下时指针在滚动内容坐标系中沿拖动方向的位置 */
  startContent: number;
  dragging: boolean;
  settling: boolean;
  tableEl: HTMLTableElement | null;
  styleEl: HTMLStyleElement | null;
  id: string;
  segments: Segment[];
  frame: Box;
  delta: number;
  target: number;
  settleTimer: ReturnType<typeof setTimeout> | null;
  originalBodyCursor: string;
  originalBodyUserSelect: string;
}

export interface DragView {
  axis: TableAxis;
  frame: Box;
  phase: 'dragging' | 'settling';
}

let sessionSeq = 0;

export function nextSessionId(): string {
  return `t${++sessionSeq}`;
}

/** 从编辑器向外查找真正承载滚动的容器（与块拖拽把手一致） */
export function findScrollParent(editorDom: HTMLElement): HTMLElement {
  let current = editorDom.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return current;
    current = current.parentElement;
  }
  return editorDom.parentElement ?? editorDom;
}

/** 视口坐标换算到滚动内容坐标的偏移量 */
export function contentOffset(scrollParent: HTMLElement): { x: number; y: number } {
  const rect = scrollParent.getBoundingClientRect();
  return { x: scrollParent.scrollLeft - rect.left, y: scrollParent.scrollTop - rect.top };
}

/** 表格节点对应的 <table> 元素（节点视图外层是 tableWrapper） */
export function getTableElement(view: EditorView, tablePos: number): HTMLTableElement | null {
  const dom = view.nodeDOM(tablePos);
  if (dom instanceof HTMLTableElement) return dom;
  if (!(dom instanceof HTMLElement)) return null;
  for (const child of Array.from(dom.children)) {
    if (child instanceof HTMLTableElement) return child;
  }
  return null;
}

/** 位置所在的单元格；单元格深度至少为 3（表格可嵌在列表等容器内） */
export function targetFromResolved($pos: ResolvedPos): CellTarget | null {
  for (let depth = $pos.depth; depth >= 3; depth--) {
    const role = $pos.node(depth).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      return { tablePos: $pos.before(depth - 2), row: $pos.index(depth - 2), col: $pos.index(depth - 1) };
    }
  }
  return null;
}

export function targetFromSelection(state: EditorState): CellTarget | null {
  const { selection, doc } = state;
  if (selection instanceof CellSelection) return targetFromResolved(doc.resolve(selection.$headCell.pos + 1));
  return targetFromResolved(selection.$head);
}

export function targetFromCellElement(view: EditorView, cell: HTMLElement): CellTarget | null {
  try {
    return targetFromResolved(view.state.doc.resolve(view.posAtDOM(cell, 0)));
  } catch {
    return null;
  }
}

export function sameTarget(a: CellTarget | null, b: CellTarget | null): boolean {
  return a === b || (!!a && !!b && a.tablePos === b.tablePos && a.row === b.row && a.col === b.col);
}

/** 表格在横向滚动容器中实际可见的左右范围（视口坐标） */
export function visibleRange(tableEl: HTMLTableElement): { left: number; right: number } {
  const tableRect = tableEl.getBoundingClientRect();
  const wrapperRect = (tableEl.parentElement ?? tableEl).getBoundingClientRect();
  return { left: Math.max(tableRect.left, wrapperRect.left), right: Math.min(tableRect.right, wrapperRect.right) };
}

/** 读取目标单元格所在行列的把手坐标与高亮框 */
export function measure(view: EditorView, scrollParent: HTMLElement, target: CellTarget): HandleLayout | null {
  const table = view.state.doc.nodeAt(target.tablePos);
  if (!table || !isTableReorderable(table)) return null;
  const tableEl = getTableElement(view, target.tablePos);
  const rowEl = tableEl?.rows[target.row];
  const cellEl = rowEl?.cells[target.col];
  if (!tableEl || !rowEl || !cellEl) return null;

  const tableRect = tableEl.getBoundingClientRect();
  // 表格不可见（如位于收起的折叠块内）
  if (tableRect.width === 0 && tableRect.height === 0) return null;
  const offset = contentOffset(scrollParent);
  const visible = visibleRange(tableEl);
  const rowRect = rowEl.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();
  const columnCenter = (cellRect.left + cellRect.right) / 2;
  const columnLeft = Math.max(cellRect.left, visible.left);
  const columnRight = Math.min(cellRect.right, visible.right);

  return {
    target,
    row: { x: visible.left + offset.x, y: (rowRect.top + rowRect.bottom) / 2 + offset.y },
    column: columnCenter >= visible.left + 6 && columnCenter <= visible.right - 6
      ? { x: columnCenter + offset.x, y: tableRect.top + offset.y }
      : null,
    rowBox: {
      left: visible.left + offset.x,
      top: rowRect.top + offset.y,
      width: visible.right - visible.left,
      height: rowRect.height,
    },
    columnBox: {
      left: columnLeft + offset.x,
      top: tableRect.top + offset.y,
      width: Math.max(0, columnRight - columnLeft),
      height: tableRect.height,
    },
  };
}

/** 第 index 行 / 列全部单元格的选择器；tag 限定 th 或 td */
export function cellSelector(session: DragSession, index: number, tag = '*'): string {
  const base = `.ProseMirror table[data-nb-table-dnd="${session.id}"] > tbody > tr`;
  return session.axis === 'row'
    ? `${base}:nth-child(${index + 1}) > ${tag}`
    : `${base} > ${tag}:nth-child(${index + 1})`;
}

/**
 * 写入本次拖动的单元格位移规则
 * @param moved 被拖动（或落位中）的行列序号，其位移由 CSS 变量驱动
 * @param withShifts 是否让其余行列让位（仅拖动中）
 * @param follow 被拖动行列是否跟手（关闭过渡）
 */
export function writeRules(session: DragSession, moved: number, withShifts: boolean, follow: boolean) {
  if (!session.styleEl) return;
  const { axis, index, target, segments } = session;
  const variable = axis === 'row' ? 'translate3d(0, var(--nb-dnd-y, 0px), 0)' : 'translate3d(var(--nb-dnd-x, 0px), 0, 0)';
  const rules = [
    `${cellSelector(session, moved)} { transform: ${variable}; z-index: 3;${follow ? ' transition: none;' : ''} }`,
    // 被拖动的单元格需不透明底色盖住让位的单元格；表头叠加表头底色
    `${cellSelector(session, moved, 'td')} { background-color: var(--editor-bg); }`,
    `${cellSelector(session, moved, 'th')} { background: linear-gradient(var(--editor-code-bg), var(--editor-code-bg)), var(--editor-bg); }`,
  ];
  if (withShifts && target !== index) {
    const size = segments[index].end - segments[index].start;
    // 向后拖：中间的行列前移一个拖动元素的尺寸；向前拖：后移
    const shift = target > index ? -size : size;
    const [from, to] = target > index ? [index + 1, target] : [target, index - 1];
    for (let current = from; current <= to; current++) {
      const translate = axis === 'row' ? `translate3d(0, ${shift}px, 0)` : `translate3d(${shift}px, 0, 0)`;
      rules.push(`${cellSelector(session, current)} { transform: ${translate}; }`);
    }
  }
  session.styleEl.textContent = rules.join('\n');
}

/** 六点抓手图标：行把手竖排、列把手横排 */
export function GripIcon({ axis }: { axis: TableAxis }) {
  const dots = axis === 'row'
    ? [[2, 2], [6, 2], [2, 6], [6, 6], [2, 10], [6, 10]]
    : [[2, 2], [6, 2], [10, 2], [2, 6], [6, 6], [10, 6]];
  const width = axis === 'row' ? 8 : 12;
  const height = axis === 'row' ? 12 : 8;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} fill="currentColor" />)}
    </svg>
  );
}
