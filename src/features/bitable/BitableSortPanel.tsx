// NoteBoard 多维表格排序规则面板
// 表格视图与甘特图视图共用：多字段排序、按字段类型给出专有方向文案、应用与取消分离。

import React, { useState } from 'react';
import type { BitableColumn, SortRule } from './bitableTypes';
import { FieldSelectButton } from './BitableFieldMeta';
import { Tooltip } from '../../components/Tooltip';
import { getSortDirectionLabels } from './bitableUtils';
import { showToast } from '../../stores/toastStore';
import { Plus, X } from 'lucide-react';

export interface SortRulesPanelProps {
  columns: BitableColumn[];
  sortRules: SortRule[];
  onChange: (rules: SortRule[]) => void;
  onClose: () => void;
}

export function SortRulesPanel({ columns, sortRules, onChange, onClose }: SortRulesPanelProps) {
  const [localRules, setLocalRules] = useState<SortRule[]>(sortRules);

  const updateRule = (index: number, patch: Partial<SortRule>) => {
    setLocalRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRule = (index: number) => {
    setLocalRules((prev) => prev.filter((_, i) => i !== index));
  };

  const addRule = () => {
    const unusedCol = columns.find((c) => !localRules.some((r) => r.columnId === c.id));
    if (!unusedCol) {
      showToast('所有字段都已加入排序');
      return;
    }
    setLocalRules((prev) => [...prev, { columnId: unusedCol.id, direction: 'asc' }]);
  };

  const apply = () => {
    onChange(localRules);
    onClose();
  };

  const clearAll = () => {
    onChange([]);
    onClose();
  };

  return (
    // 宽度交给外层 FloatingPanel 决定：内部再写死宽度会和容器 padding 相加，
    // 撑出浮层可视宽度从而出现横向滚动条。
    <div
      style={{
        padding: 'var(--dim-10) var(--dim-12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--dim-10)',
        width: 'var(--pct-100)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-13)', fontWeight: 'var(--weight-600)', color: 'var(--editor-text)' }}>排序</span>
        {sortRules.length > 0 && (
          <button type="button" onClick={clearAll} className="nb-bitable-btn-ghost" style={{ fontSize: 'var(--text-11)', padding: 'var(--dim-2) var(--dim-6)' }}>
            清除全部
          </button>
        )}
      </div>

      {localRules.length === 0 && (
        <div style={{ fontSize: 'var(--text-12)', color: 'var(--editor-text-muted)', padding: 'var(--dim-6) 0' }}>未设置排序字段</div>
      )}

      {localRules.map((rule, index) => {
        const col = columns.find((c) => c.id === rule.columnId);
        if (!col) return null;
        const labels = getSortDirectionLabels(col.type);
        const usedColIds = localRules.map((r) => r.columnId);
        return (
          <div key={`${rule.columnId}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', width: 'var(--dim-18)', flexShrink: 0 }}>{index + 1}</span>
            <FieldSelectButton
              columns={columns}
              value={rule.columnId}
              onChange={(colId) => colId && updateRule(index, { columnId: colId })}
              disabledColIds={usedColIds.filter((id) => id !== rule.columnId)}
              width={140}
            />
            <button
              type="button"
              className="nb-bitable-btn-secondary"
              onClick={() => updateRule(index, { direction: rule.direction === 'asc' ? 'desc' : 'asc' })}
              style={{
                flex: 1,
                minWidth: 0,
                padding: 'var(--dim-3) var(--dim-6)',
                fontSize: 'var(--text-11)',
              }}
            >
              {rule.direction === 'asc' ? labels.asc : labels.desc}
            </button>
            <Tooltip content="移除该排序字段" side="top" sideOffset={4}>
              <button
                type="button"
                className="nb-bitable-btn-ghost"
                onClick={() => removeRule(index)}
                aria-label="移除该排序字段"
                style={{ padding: 'var(--dim-4)', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </Tooltip>
          </div>
        );
      })}

      {localRules.length < columns.length && (
        <button
          type="button"
          className="nb-bitable-btn-secondary"
          onClick={addRule}
          style={{
            borderStyle: 'dashed',
            padding: 'var(--dim-5) var(--dim-10)',
            color: 'var(--editor-text-muted)',
          }}
        >
          <Plus size={13} />
          <span>添加排序字段</span>
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--dim-8)', marginTop: 'var(--dim-4)' }}>
        <button type="button" onClick={onClose} className="nb-bitable-btn-secondary" style={{ padding: 'var(--dim-4) var(--dim-10)' }}>
          取消
        </button>
        <button type="button" onClick={apply} className="nb-bitable-btn-primary" style={{ padding: 'var(--dim-4) var(--dim-12)' }}>
          应用
        </button>
      </div>
    </div>
  );
}
