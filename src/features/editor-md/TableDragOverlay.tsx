// 表格拖动把手的浮层：两个拖动把手与拖动 / 悬停时的行列高亮框

import type { PointerEvent as ReactPointerEvent } from 'react';
import { Tooltip } from '../../components/Tooltip';
import type { TableAxis } from './tableReorder';
import { GripIcon, type DragView, type HandleLayout } from './tableDragHandleCore';

interface TableDragOverlayProps {
  layout: HandleLayout | null;
  dragView: DragView | null;
  hoveredHandle: TableAxis | null;
  isTextSelecting: boolean;
  onPointerDown: (axis: TableAxis, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
  onHandleEnter: (axis: TableAxis) => void;
  onHandleLeave: (axis: TableAxis) => void;
}

export function TableDragOverlay(props: TableDragOverlayProps) {
  const { layout, dragView, hoveredHandle, isTextSelecting } = props;
  const dragging = dragView?.phase === 'dragging' ? dragView.axis : null;
  const busy = dragView !== null;

  /** 渲染一个把手；拖动中把手跟随浮起框移动 */
  const renderHandle = (axis: TableAxis) => {
    if (!layout) return null;
    if (dragView && dragView.axis !== axis) return null;
    const anchor = axis === 'row' ? layout.row : layout.column;
    if (!anchor) return null;
    let { x, y } = anchor;
    if (dragView) {
      if (axis === 'row') y = dragView.frame.top + dragView.frame.height / 2;
      else x = dragView.frame.left + dragView.frame.width / 2;
    }
    const label = axis === 'row' ? '拖动排序，单击选中整行' : '拖动排序，单击选中整列';
    return (
      // 拖动中不切换 disabled（会重建按钮、打断指针捕获），改由 body 上的拖动标记隐藏提示
      <Tooltip key={`${axis}-${layout.target.tablePos}`} content={label} side={axis === 'row' ? 'left' : 'top'} sideOffset={6}>
        <button
          type="button"
          className={[
            'nb-table-handle',
            axis === 'row' ? 'is-row' : 'is-column',
            hoveredHandle === axis ? 'is-hovered' : '',
            dragging === axis ? 'is-dragging' : '',
            isTextSelecting && !busy ? 'is-passive' : '',
          ].filter(Boolean).join(' ')}
          style={{ left: x, top: y }}
          aria-label={axis === 'row' ? '拖动表格行' : '拖动表格列'}
          onPointerDown={(event) => props.onPointerDown(axis, event)}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onPointerCancel={props.onPointerCancel}
          onMouseEnter={() => props.onHandleEnter(axis)}
          onMouseLeave={() => props.onHandleLeave(axis)}
        >
          <GripIcon axis={axis} />
        </button>
      </Tooltip>
    );
  };

  // 浮起框：拖动 / 落位中跟随被拖动的行列；平时悬停把手时标出整行 / 整列
  const frameBox = dragView?.frame
    ?? (layout && hoveredHandle ? (hoveredHandle === 'row' ? layout.rowBox : layout.columnBox) : null);

  return (
    <>
      {frameBox && (
        <div
          key={dragView ? 'drag-frame' : `hint-${hoveredHandle}`}
          className={`nb-table-axis-frame${dragView ? ` is-${dragView.phase}` : ''}`}
          style={{ left: frameBox.left, top: frameBox.top, width: frameBox.width, height: frameBox.height }}
          aria-hidden="true"
        />
      )}
      {renderHandle('row')}
      {renderHandle('column')}
    </>
  );
}
