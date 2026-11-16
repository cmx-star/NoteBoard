// 关系图谱缩放控件：放大、缩小与适应视图

import { Maximize, Minus, Plus } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';

export function LinkGraphControls({ onZoom, onFit }: { onZoom: (factor: number) => void; onFit: () => void }) {
  return (
    <div className="nb-graph-controls" data-sheet-keep="">
      <Tooltip content="放大">
        <button type="button" className="nb-graph-control" aria-label="放大" onClick={() => onZoom(1.3)}>
          <Plus size={14} />
        </button>
      </Tooltip>
      <Tooltip content="缩小">
        <button type="button" className="nb-graph-control" aria-label="缩小" onClick={() => onZoom(1 / 1.3)}>
          <Minus size={14} />
        </button>
      </Tooltip>
      <Tooltip content="适应视图">
        <button type="button" className="nb-graph-control" aria-label="适应视图" onClick={onFit}>
          <Maximize size={13} />
        </button>
      </Tooltip>
    </div>
  );
}
