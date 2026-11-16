// NoteBoard Markdown 表格行 / 列拖动把手
// 鼠标悬停单元格或光标位于单元格内时，在该行左边框、该列上边框显示把手：
// 单击选中整行 / 整列，按住拖动调整顺序。拖动中其余行列实时让位，松手后平滑落位。
//
// 实现要点：单元格由 ProseMirror 管理，直接改其 style / class 会被当成 DOM 变更重新解析。
// 因此位移全部通过注入的样式表（按行列序号选择单元格）与 <table> 上的 CSS 变量完成，
// 表格节点视图（TableView）会忽略 <table> 自身的属性变更。

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Editor } from '@tiptap/core';
import { isTableReorderable, moveTableAxisTr, resolveDropIndex, type TableAxis } from './tableReorder';
import {
  AUTO_SCROLL_EDGE,
  AUTO_SCROLL_MAX_STEP,
  HIDE_DELAY,
  SETTLE_DURATION,
  cellSelector,
  contentOffset,
  findScrollParent,
  getTableElement,
  measure,
  sameTarget,
  targetFromCellElement,
  targetFromResolved,
  targetFromSelection,
  visibleRange,
  writeRules,
  type CellTarget,
  type DragSession,
  type DragView,
  type HandleLayout,
  nextSessionId,
  type Segment,
} from './tableDragHandleCore';
import { useTableHandlePointers } from './tableDragHandlePointers';
import { TableDragOverlay } from './TableDragOverlay';
import '../../styles/tableDragHandle.css';


export function TableDragHandles({ editor }: { editor: Editor | null }) {
  const [hoverTarget, setHoverTarget] = useState<CellTarget | null>(null);
  const [cursorTarget, setCursorTarget] = useState<CellTarget | null>(null);
  const [layout, setLayout] = useState<HandleLayout | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [hoveredHandle, setHoveredHandle] = useState<TableAxis | null>(null);
  const [dragView, setDragView] = useState<DragView | null>(null);
  // 正文按住鼠标拖选期间把手不截获指针
  const [isTextSelecting, setIsTextSelecting] = useState(false);
  const sessionRef = useRef<DragSession | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overHandleRef = useRef(false);
  const frameRequestRef = useRef<number | null>(null);

  /** 合并同一帧内的多次重新测量请求 */
  const requestLayout = useCallback(() => {
    if (frameRequestRef.current !== null) return;
    frameRequestRef.current = requestAnimationFrame(() => {
      frameRequestRef.current = null;
      setLayoutTick((tick) => tick + 1);
    });
  }, []);

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current || sessionRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (!overHandleRef.current && !sessionRef.current) setHoverTarget(null);
    }, HIDE_DELAY);
  }, []);

  /** 结束拖动会话：撤掉表格上的临时属性、样式表与全局光标 */
  const cleanupSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    if (session.settleTimer) clearTimeout(session.settleTimer);
    if (session.tableEl) {
      session.tableEl.removeAttribute('data-nb-table-dnd');
      session.tableEl.removeAttribute('data-nb-table-dnd-phase');
      session.tableEl.style.removeProperty('--nb-dnd-x');
      session.tableEl.style.removeProperty('--nb-dnd-y');
    }
    session.styleEl?.remove();
    if (session.dragging) {
      document.body.style.cursor = session.originalBodyCursor;
      document.body.style.userSelect = session.originalBodyUserSelect;
      document.body.removeAttribute('data-nb-table-dragging');
    }
    if (session.handle.hasPointerCapture?.(session.pointerId)) {
      session.handle.releasePointerCapture(session.pointerId);
    }
    setDragView(null);
    requestLayout();
  }, [requestLayout]);

  // 悬停单元格时显示该行列的把手；离开表格后延迟收起
  useEffect(() => {
    if (!editor) return;
    const editorDom = editor.view.dom;
    const handleMouseMove = (event: MouseEvent) => {
      if (sessionRef.current) return;
      const cell = (event.target as Element | null)?.closest?.('td, th');
      if (cell instanceof HTMLElement && editorDom.contains(cell) && editor.isEditable) {
        const target = targetFromCellElement(editor.view, cell);
        if (target) {
          clearHideTimer();
          setHoverTarget((current) => (sameTarget(current, target) ? current : target));
          return;
        }
      }
      scheduleHide();
    };
    const handleMouseLeave = () => scheduleHide();
    editorDom.addEventListener('mousemove', handleMouseMove);
    editorDom.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      editorDom.removeEventListener('mousemove', handleMouseMove);
      editorDom.removeEventListener('mouseleave', handleMouseLeave);
      clearHideTimer();
    };
  }, [clearHideTimer, editor, scheduleHide]);

  // 光标所在单元格（编辑器聚焦时）同样显示把手；文档变化时把悬停目标映射到新位置
  useEffect(() => {
    if (!editor) return;
    const syncCursor = () => {
      const target = editor.isEditable && editor.view.hasFocus() ? targetFromSelection(editor.state) : null;
      setCursorTarget((current) => (sameTarget(current, target) ? current : target));
      requestLayout();
    };
    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean; mapping: { mapResult: (pos: number) => { pos: number; deleted: boolean } } } }) => {
      if (transaction.docChanged) {
        setHoverTarget((current) => {
          if (!current) return current;
          const mapped = transaction.mapping.mapResult(current.tablePos);
          return mapped.deleted ? null : { ...current, tablePos: mapped.pos };
        });
      }
      syncCursor();
    };
    syncCursor();
    editor.on('transaction', handleTransaction);
    editor.on('focus', syncCursor);
    editor.on('blur', syncCursor);
    return () => {
      editor.off('transaction', handleTransaction);
      editor.off('focus', syncCursor);
      editor.off('blur', syncCursor);
    };
  }, [editor, requestLayout]);

  // 表格横向滚动、窗口与编辑区尺寸变化时重新测量
  useEffect(() => {
    if (!editor) return;
    const editorDom = editor.view.dom;
    editorDom.addEventListener('scroll', requestLayout, true);
    window.addEventListener('resize', requestLayout);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(requestLayout) : null;
    observer?.observe(editorDom);
    return () => {
      editorDom.removeEventListener('scroll', requestLayout, true);
      window.removeEventListener('resize', requestLayout);
      observer?.disconnect();
      if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    };
  }, [editor, requestLayout]);

  // 跟踪正文拖选：编辑器内左键按下开始，松开或窗口失焦时结束
  useEffect(() => {
    if (!editor) return;
    const editorDom = editor.view.dom;
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) setIsTextSelecting(true);
    };
    const handleMouseUp = () => setIsTextSelecting(false);
    editorDom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('blur', handleMouseUp);
    return () => {
      editorDom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('blur', handleMouseUp);
    };
  }, [editor]);

  const activeTarget = hoverTarget ?? cursorTarget;

  // 拖动期间冻结把手布局，其余时间按目标单元格重新测量
  useLayoutEffect(() => {
    if (!editor || sessionRef.current) return;
    const next = activeTarget ? measure(editor.view, findScrollParent(editor.view.dom), activeTarget) : null;
    setLayout(next);
    if (!next) setHoveredHandle(null);
  }, [activeTarget, editor, layoutTick]);

  /** 拖动中：自动滚动、计算位移与目标序号，必要时更新让位规则 */
  const updateDrag = useCallback((session: DragSession, clientX: number, clientY: number) => {
    const { scrollParent, axis, segments, index } = session;
    if (axis === 'row') {
      const rect = scrollParent.getBoundingClientRect();
      if (clientY < rect.top + AUTO_SCROLL_EDGE) {
        const ratio = Math.min(1, (rect.top + AUTO_SCROLL_EDGE - clientY) / AUTO_SCROLL_EDGE);
        scrollParent.scrollTop -= Math.ceil(AUTO_SCROLL_MAX_STEP * ratio);
      } else if (clientY > rect.bottom - AUTO_SCROLL_EDGE) {
        const ratio = Math.min(1, (clientY - rect.bottom + AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);
        scrollParent.scrollTop += Math.ceil(AUTO_SCROLL_MAX_STEP * ratio);
      }
    }
    const offset = contentOffset(scrollParent);
    const pointer = axis === 'row' ? clientY + offset.y : clientX + offset.x;
    const source = segments[index];
    // 拖动元素限制在表格范围内
    const min = segments[0].start - source.start;
    const max = segments[segments.length - 1].end - source.end;
    const delta = Math.max(min, Math.min(max, pointer - session.startContent));
    session.delta = delta;

    // 拖动方向上的前沿越过相邻元素中线即交换（见 resolveDropIndex）
    const target = resolveDropIndex(segments, index, delta);
    if (target !== session.target) {
      session.target = target;
      writeRules(session, index, true, true);
    }
    session.tableEl?.style.setProperty(axis === 'row' ? '--nb-dnd-y' : '--nb-dnd-x', `${delta}px`);
    const frame = axis === 'row'
      ? { ...session.frame, top: session.frame.top + delta }
      : { ...session.frame, left: session.frame.left + delta };
    setDragView({ axis, frame, phase: 'dragging' });
  }, []);

  /** 越过拖动阈值：切换表格为拖动态并记录各行列的区间 */
  const beginDrag = useCallback((session: DragSession): boolean => {
    if (!editor) return false;
    const tableEl = getTableElement(editor.view, session.tablePos);
    if (!tableEl || !tableEl.rows.length) return false;
    session.id = nextSessionId();
    session.tableEl = tableEl;
    tableEl.setAttribute('data-nb-table-dnd', session.id);
    tableEl.setAttribute('data-nb-table-dnd-phase', 'drag');
    session.styleEl = document.createElement('style');
    document.head.appendChild(session.styleEl);

    // 切换为分离边框后再测量，区间与拖动中的真实布局一致
    const offset = contentOffset(session.scrollParent);
    const rows = Array.from(tableEl.rows);
    session.segments = session.axis === 'row'
      ? rows.map((row) => {
        const rect = row.getBoundingClientRect();
        return { start: rect.top + offset.y, end: rect.bottom + offset.y };
      })
      : Array.from(rows[0].cells).map((cell) => {
        const rect = cell.getBoundingClientRect();
        return { start: rect.left + offset.x, end: rect.right + offset.x };
      });
    const source = session.segments[session.index];
    if (!source) return false;
    const tableRect = tableEl.getBoundingClientRect();
    const visible = visibleRange(tableEl);
    session.frame = session.axis === 'row'
      ? { left: visible.left + offset.x, top: source.start, width: visible.right - visible.left, height: source.end - source.start }
      : { left: source.start, top: tableRect.top + offset.y, width: source.end - source.start, height: tableRect.height };

    session.dragging = true;
    session.target = session.index;
    writeRules(session, session.index, true, true);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.body.setAttribute('data-nb-table-dragging', '');
    return true;
  }, [editor]);

  /** 松手或取消：提交移动并让单元格从当前位置平滑落到新位置 */
  const finishDrag = useCallback((session: DragSession, commit: boolean) => {
    if (!editor || !session.tableEl) {
      cleanupSession();
      return;
    }
    const { axis, index, target, segments, tableEl } = session;
    const variable = axis === 'row' ? '--nb-dnd-y' : '--nb-dnd-x';
    const size = segments[index].end - segments[index].start;
    session.settling = true;

    let settledIndex = index;
    let finalStart = segments[index].start;
    const tr = commit && target !== index ? moveTableAxisTr(editor.state, session.tablePos, axis, index, target) : null;
    if (tr) {
      // 移动后该行列的自然位置；剩余位移 = 当前视觉位置 - 自然位置
      finalStart = target > index ? segments[target].end - size : segments[target].start;
      const remaining = segments[index].start + session.delta - finalStart;
      // 关闭过渡后同步切换文档顺序：让位的行列已处在最终位置，被拖动的行列以剩余位移停在原处
      tableEl.setAttribute('data-nb-table-dnd-phase', 'instant');
      writeRules(session, target, false, true);
      tableEl.style.setProperty(variable, `${remaining}px`);
      editor.view.dispatch(tr);
      settledIndex = target;
      // 指针仍停在把手上：把手目标跟随到移动后的行列
      setHoverTarget((current) => (current && current.tablePos === session.tablePos
        ? { ...current, [axis === 'row' ? 'row' : 'col']: target }
        : current));
      // 表格视图被重建时无法衔接动画，直接结束
      if (getTableElement(editor.view, session.tablePos) !== tableEl) {
        cleanupSession();
        return;
      }
      // 强制回流，使剩余位移先生效，再开启过渡归零
      void tableEl.offsetWidth;
    }
    tableEl.setAttribute('data-nb-table-dnd-phase', 'settle');
    writeRules(session, settledIndex, false, false);
    tableEl.style.setProperty(variable, '0px');
    const frame = axis === 'row'
      ? { ...session.frame, top: finalStart }
      : { ...session.frame, left: finalStart };
    setDragView({ axis, frame, phase: 'settling' });
    document.body.style.cursor = session.originalBodyCursor;
    document.body.style.userSelect = session.originalBodyUserSelect;
    session.settleTimer = setTimeout(cleanupSession, SETTLE_DURATION + 40);
  }, [cleanupSession, editor]);

  // 窗口失焦、按 Esc 时取消拖动；卸载时清理残留
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const session = sessionRef.current;
      if (event.key !== 'Escape' || !session?.dragging || session.settling) return;
      event.preventDefault();
      event.stopPropagation();
      finishDrag(session, false);
    };
    const handleBlur = () => {
      const session = sessionRef.current;
      if (session?.dragging && !session.settling) finishDrag(session, false);
      else if (session && !session.dragging) cleanupSession();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [cleanupSession, finishDrag]);

  useEffect(() => () => cleanupSession(), [cleanupSession]);


  const { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useTableHandlePointers({
    editor,
    layout,
    sessionRef,
    cleanupSession,
    clearHideTimer,
    beginDrag,
    updateDrag,
    finishDrag,
  });

  if (!editor || (!layout && !dragView)) return null;


  if (!editor || (!layout && !dragView)) return null;

  return (
    <TableDragOverlay
      layout={layout}
      dragView={dragView}
      hoveredHandle={hoveredHandle}
      isTextSelecting={isTextSelecting}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onHandleEnter={(axis) => {
        overHandleRef.current = true;
        clearHideTimer();
        setHoveredHandle(axis);
      }}
      onHandleLeave={(axis) => {
        overHandleRef.current = false;
        setHoveredHandle((current) => (current === axis ? null : current));
        scheduleHide();
      }}
    />
  );
}
