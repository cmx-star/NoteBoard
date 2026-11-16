// 表格拖动把手的指针事件处理：按下建立会话、拖动更新、松开提交与取消
import { useCallback, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import type { Editor } from '@tiptap/core';
import { selectTableAxisTr, type TableAxis } from './tableReorder';
import { contentOffset, DRAG_START_DISTANCE, findScrollParent, type DragSession, type HandleLayout } from './tableDragHandleCore';

interface TableHandlePointersOptions {
  editor: Editor | null;
  layout: HandleLayout | null;
  sessionRef: MutableRefObject<DragSession | null>;
  cleanupSession: () => void;
  clearHideTimer: () => void;
  beginDrag: (session: DragSession) => boolean;
  updateDrag: (session: DragSession, clientX: number, clientY: number) => void;
  finishDrag: (session: DragSession, commit: boolean) => void;
}

export function useTableHandlePointers(options: TableHandlePointersOptions) {
  const { editor, layout, sessionRef, cleanupSession, clearHideTimer, beginDrag, updateDrag, finishDrag } = options;

  const handlePointerDown = useCallback((axis: TableAxis, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editor || !layout || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // 上一次落位动画尚未结束：立即收尾
    if (sessionRef.current) cleanupSession();
    clearHideTimer();
    const scrollParent = findScrollParent(editor.view.dom);
    const offset = contentOffset(scrollParent);
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      axis,
      tablePos: layout.target.tablePos,
      index: axis === 'row' ? layout.target.row : layout.target.col,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      scrollParent,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startContent: axis === 'row' ? event.clientY + offset.y : event.clientX + offset.x,
      dragging: false,
      settling: false,
      tableEl: null,
      styleEl: null,
      id: '',
      segments: [],
      frame: { left: 0, top: 0, width: 0, height: 0 },
      delta: 0,
      target: 0,
      settleTimer: null,
      originalBodyCursor: document.body.style.cursor,
      originalBodyUserSelect: document.body.style.userSelect,
    };
  }, [cleanupSession, clearHideTimer, editor, layout]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId || session.settling) return;
    event.preventDefault();
    if (!session.dragging) {
      const distance = Math.hypot(event.clientX - session.startClientX, event.clientY - session.startClientY);
      if (distance < DRAG_START_DISTANCE) return;
      if (!beginDrag(session)) {
        cleanupSession();
        return;
      }
    }
    updateDrag(session, event.clientX, event.clientY);
  }, [beginDrag, cleanupSession, updateDrag]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId || session.settling) return;
    event.preventDefault();
    if (session.handle.hasPointerCapture(event.pointerId)) session.handle.releasePointerCapture(event.pointerId);
    // 未越过拖动阈值即单击：选中整行 / 整列
    if (!session.dragging) {
      cleanupSession();
      if (!editor) return;
      const tr = selectTableAxisTr(editor.state, session.tablePos, session.axis, session.index);
      if (tr) {
        editor.view.dispatch(tr);
        editor.view.focus();
      }
      return;
    }
    finishDrag(session, true);
  }, [cleanupSession, editor, finishDrag]);

  const handlePointerCancel = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.settling) return;
    if (session.dragging) finishDrag(session, false);
    else cleanupSession();
  }, [cleanupSession, finishDrag]);

  return { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel };
}
