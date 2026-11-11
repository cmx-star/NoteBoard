// NoteBoard 多维表格字段类型元数据
// 表头、列菜单、记录详情侧边栏、分组/排序字段选择器共用同一套图标与文案

import React, { useState } from 'react';
import type { BitableColumn, BitableFieldType } from './bitableTypes';
import { FloatingPanel, getAnchorRect, type AnchorRect } from './BitableFloating';
import {
  Type,
  AlignLeft,
  Hash,
  Tag,
  Tags,
  Calendar,
  CalendarClock,
  Clock,
  CheckSquare,
  Star,
  BarChart2,
  Link,
  ChevronDown,
} from 'lucide-react';

export interface FieldTypeMeta {
  icon: React.ReactNode;
  label: string;
}

/** 获取字段类型的展示元数据（图标 + 中文名） */
export function getFieldTypeMeta(type: BitableFieldType): FieldTypeMeta {
  switch (type) {
    case 'text':
      return { icon: <Type size={13} color="var(--nb-blue-500)" />, label: '单行文本' };
    case 'longText':
      return { icon: <AlignLeft size={13} color="var(--nb-auto-0ea5e9)" />, label: '多行文本' };
    case 'number':
      return { icon: <Hash size={13} color="var(--nb-emerald-500)" />, label: '数字' };
    case 'select':
      return { icon: <Tag size={13} color="var(--nb-purple-500)" />, label: '单选' };
    case 'multiSelect':
      return { icon: <Tags size={13} color="var(--nb-pink-500)" />, label: '多选' };
    case 'date':
      return { icon: <Calendar size={13} color="var(--nb-amber-500)" />, label: '日期' };
    case 'time':
      return { icon: <Clock size={13} color="var(--nb-teal-500)" />, label: '时间' };
    case 'dateTime':
      return { icon: <CalendarClock size={13} color="var(--nb-violet-500)" />, label: '日期时间' };
    case 'checkbox':
      return { icon: <CheckSquare size={13} color="var(--nb-cyan-500)" />, label: '勾选' };
    case 'rating':
      return { icon: <Star size={13} color="var(--nb-yellow-500)" />, label: '评分' };
    case 'progress':
      return { icon: <BarChart2 size={13} color="var(--nb-blue-500)" />, label: '进度' };
    case 'link':
      return { icon: <Link size={13} color="var(--nb-violet-500)" />, label: '超链接' };
    default:
      // 未知类型兜底：外部数据可能携带本版本不认识的字段类型，不能让渲染崩掉
      return { icon: <Type size={13} color="var(--nb-slate-400)" />, label: '未知字段' };
  }
}

interface FieldSelectButtonProps {
  columns: BitableColumn[];
  value: string | null;
  placeholder?: string;
  onChange: (colId: string | null) => void;
  disabledColIds?: string[];
  width?: number;
}

/**
 * 通用字段选择触发器
 * 用于表格视图/看板视图的分组、排序等场景；列表项显示字段彩色类型图标与中文名称。
 */
export function FieldSelectButton({
  columns,
  value,
  placeholder = '请选择字段',
  onChange,
  disabledColIds = [],
  width = 160,
}: FieldSelectButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);

  const selectedCol = columns.find((c) => c.id === value);
  const meta = selectedCol ? getFieldTypeMeta(selectedCol.type) : null;

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = getAnchorRect(e.currentTarget);
    if (!rect) return;
    setAnchor(rect);
    setTrigger(e.currentTarget);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="nb-bitable-btn-secondary"
        onClick={handleOpen}
        style={{
          gap: 'var(--dim-6)',
          padding: 'var(--dim-3) var(--dim-8)',
          fontSize: 'var(--text-12)',
          minWidth: width,
          maxWidth: width,
        }}
      >
        {meta && selectedCol ? (
          <>
            {meta.icon}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'left',
              }}
            >
              {selectedCol.name}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--editor-text-muted)', flex: 1, textAlign: 'left' }}>
            {placeholder}
          </span>
        )}
        <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 'var(--opacity-0-6)', flexShrink: 0 }} />
      </button>
      {open && anchor && trigger && (
        <FloatingPanel anchor={anchor} trigger={trigger} width={200} onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 'var(--dim-4)' }}>
            <button
              type="button"
              className="nb-bitable-menu-item"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              style={{
                background: value === null ? 'var(--editor-bg)' : undefined,
                color: 'var(--editor-text-muted)',
              }}
            >
              <span>{placeholder}</span>
            </button>
            {columns
              .filter((c) => !disabledColIds.includes(c.id))
              .map((col) => {
                const colMeta = getFieldTypeMeta(col.type);
                const isSelected = col.id === value;
                return (
                  <button
                    key={col.id}
                    type="button"
                    className="nb-bitable-menu-item"
                    onClick={() => {
                      onChange(col.id);
                      setOpen(false);
                    }}
                    style={{
                      background: isSelected ? 'var(--editor-bg)' : undefined,
                    }}
                  >
                    {colMeta.icon}
                    <span>{col.name}</span>
                  </button>
                );
              })}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}
