// NoteBoard 多维表格标签徽章与选项管理面板
// 单元格选择面板与表头字段配置面板共用同一套「增 / 改名 / 改色 / 删除 / 排序」逻辑
// 面板统一走 Portal 浮层，避免被单元格与表头的 overflow 裁剪

import React, { useEffect, useRef, useState } from 'react';
import type { SelectOption, SelectOptionColor } from './bitableTypes';
import { getOptionColor, BITABLE_PALETTE } from './bitableConverter';
import { FloatingPanel, type AnchorRect } from './BitableFloating';
import { Check, Edit2, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import { CustomColorSection } from '../../components/colorPicker/CustomColorPicker';

/** 彩色标签胶囊 */
export function OptionBadge({
  option,
  onRemove,
}: {
  option: SelectOption;
  onRemove?: () => void;
}) {
  const color = getOptionColor(option.color);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--dim-4)',
        padding: 'var(--dim-2) var(--dim-8)',
        borderRadius: 'var(--dim-12)',
        background: color.bg,
        border: `var(--dim-1) solid ${color.border}`,
        color: color.text,
        fontSize: 'var(--text-12)',
        fontWeight: 'var(--weight-500)',
        lineHeight: 'var(--leading-1-3)',
        userSelect: 'none',
        maxWidth: 'var(--pct-100)',
        flexShrink: 0,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {option.label}
      </span>
      {onRemove && (
        <button
          type="button"
          className="nb-bitable-btn-ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            padding: 0,
            color: color.text,
            opacity: 'var(--opacity-0-7)',
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/**
 * 颜色挑选行：每个色块就是「标签实际长相」的微缩预览
 * —— 打底 = pal.bg、描边 = pal.border，与表格里 OptionBadge 的取值完全同源。
 *
 * 早期实现只把色块填成 pal.text（饱和色），而表格里的标签胶囊是 pal.bg 打底 + pal.text 文字，
 * 两者明度差着一整个色阶，导致在选项编辑里点色块时根本对不上「我那排标签到底是什么颜色」。
 * 现在色块底色即标签底色，所见即所得：表格里是什么颜色，编辑里就是什么颜色。
 * 不再叠中心实心圆：多出的一层会把底色压暗、又和标签长相不一致。
 */
export function ColorPickerRow({
  value,
  onChange,
  size = 20,
}: {
  value: SelectOptionColor;
  onChange: (color: SelectOptionColor) => void;
  /** 色块边长，默认 20；看板分组编辑区偏窄时传更小的值 */
  size?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-6)', padding: 'var(--dim-3) 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--dim-6)' }}>
        {BITABLE_PALETTE.map((pal) => {
          const isSelected = value === pal.id;
          return (
            <Tooltip key={pal.id} content={pal.label} side="top" sideOffset={4}>
              <div
                className="nb-bitable-color-swatch"
                onClick={() => onChange(pal.id as SelectOptionColor)}
                style={{
                  width: size,
                  height: size,
                  borderRadius: Math.max(4, Math.round(size * 0.3)),
                  background: pal.bg,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  // 色板底色全是 50 级浅色，必须靠各自的 200 级描边才分得清相邻色块
                  border: `var(--dim-1) solid ${pal.border}`,
                  // 选中态用外描边而不是改边框色：改边框会把「标签本色预览」本身弄丢
                  outline: isSelected ? 'var(--dim-2) solid var(--editor-accent)' : 'none',
                  outlineOffset: 'var(--dim-1)',
                }}
              />
            </Tooltip>
          );
        })}
      </div>
      {/* 自定义颜色：固定的色块与内置色同排外观（标签胶囊预览），「+」展开取色盘 */}
      <CustomColorSection
        kind="tag"
        variant="tag"
        activeColor={value}
        presetColors={PRESET_IDS}
        onSelect={(hex) => onChange(hex as SelectOptionColor)}
        swatchWidth={size}
      />
    </div>
  );
}

const PRESET_IDS = BITABLE_PALETTE.map((pal) => pal.id);

interface SelectOptionsPanelProps {
  anchor: AnchorRect;
  trigger?: HTMLElement | null;
  /** 面板标题，表头配置模式下用于提示当前字段 */
  title?: string;
  options: SelectOption[];
  /** 当前选中项（单元格模式传入，用于展示勾选态） */
  selectedIds?: string[];
  /** 是否允许点击选项切换选中值；表头配置模式为 false */
  selectable?: boolean;
  isMulti?: boolean;
  /** 是否展示增删改与排序操作 */
  manageable?: boolean;
  onToggleSelect?: (optionId: string) => void;
  onAddOption?: (label: string, color: SelectOptionColor) => void;
  onUpdateOption?: (optionId: string, label: string, color: SelectOptionColor) => void;
  onDeleteOption?: (optionId: string) => void;
  onMoveOption?: (optionId: string, direction: 'up' | 'down') => void;
  onClose: () => void;
}

export function SelectOptionsPanel({
  anchor,
  trigger,
  title,
  options,
  selectedIds = [],
  selectable = false,
  isMulti = false,
  manageable = true,
  onToggleSelect,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onMoveOption,
  onClose,
}: SelectOptionsPanelProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<SelectOptionColor>('blue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState<SelectOptionColor>('blue');
  const editBlockRef = useRef<HTMLDivElement>(null);

  // 进入编辑后把整块编辑区（含色板）滚进可视范围：列表限高滚动，
  // 靠下的选项展开编辑时色板会被裁在滚动区外，用户只能看到下方「新建选项」的色板而误以为改不了颜色
  useEffect(() => {
    if (editingId) editBlockRef.current?.scrollIntoView({ block: 'nearest' });
  }, [editingId]);

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label || !onAddOption) return;
    onAddOption(label, newColor);
    setNewLabel('');
  };

  const startEdit = (e: React.MouseEvent, opt: SelectOption) => {
    e.stopPropagation();
    setEditingId(opt.id);
    setEditLabel(opt.label);
    setEditColor(opt.color);
  };

  const saveEdit = (optionId: string) => {
    const label = editLabel.trim();
    if (label && onUpdateOption) {
      onUpdateOption(optionId, label, editColor);
    }
    setEditingId(null);
  };

  return (
    <FloatingPanel anchor={anchor} width={264} trigger={trigger} onClose={onClose}>
      {title && (
        <div
          style={{
            padding: 'var(--dim-2) var(--dim-6) var(--dim-4)',
            fontSize: 'var(--text-11)',
            fontWeight: 'var(--weight-600)',
            color: 'var(--editor-text-muted)',
          }}
        >
          {title}
        </div>
      )}

      {/* 选项列表 */}
      <div style={{ maxHeight: 'var(--dim-210)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--dim-2)' }}>
        {options.map((opt, idx) => {
          const isSelected = selectedIds.includes(opt.id);
          const isEditingThis = editingId === opt.id;

          if (isEditingThis) {
            return (
              <div
                key={opt.id}
                ref={editBlockRef}
                style={{
                  padding: 'var(--dim-6) var(--dim-8)',
                  borderRadius: 'var(--dim-6)',
                  background: 'var(--editor-bg)',
                  border: 'var(--dim-1) solid var(--editor-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--dim-6)',
                }}
              >
                <div style={{ display: 'flex', gap: 'var(--dim-4)' }}>
                  <input
                    type="text"
                    value={editLabel}
                    autoFocus
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(opt.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: 'var(--dim-4) var(--dim-8)',
                      fontSize: 'var(--text-12)',
                      border: 'var(--dim-1) solid var(--editor-accent)',
                      borderRadius: 'var(--dim-4)',
                      outline: 'none',
                      background: 'var(--editor-surface)',
                      color: 'var(--editor-text)',
                    }}
                  />
                  <button
                    type="button"
                    className="nb-bitable-btn-primary"
                    onClick={() => saveEdit(opt.id)}
                    style={{
                      padding: 'var(--dim-4) var(--dim-10)',
                      fontSize: 'var(--text-12)',
                    }}
                  >
                    保存
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--dim-8)', rowGap: 'var(--dim-4)' }}>
                  {/* 色板整行不收缩，标签名过长时预览徽章自动换到下一行 */}
                  <div style={{ flexShrink: 0 }}>
                    <ColorPickerRow value={editColor} onChange={setEditColor} size={18} />
                  </div>
                  {/* 实时预览改色效果，明确色板作用于当前编辑的选项 */}
                  <OptionBadge option={{ id: opt.id, label: editLabel.trim() || opt.label, color: editColor }} />
                </div>
              </div>
            );
          }

          return (
            <div
              key={opt.id}
              onClick={() => {
                if (selectable && onToggleSelect) onToggleSelect(opt.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--dim-4)',
                padding: 'var(--dim-4) var(--dim-6)',
                borderRadius: 'var(--dim-4)',
                cursor: selectable ? 'pointer' : 'default',
                background: isSelected ? 'var(--editor-selection)' : 'transparent',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'var(--toolbar-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <OptionBadge option={opt} />
                {isSelected && <Check size={14} color="var(--nb-blue-500)" />}
              </div>

              {manageable && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-2)' }} onClick={(e) => e.stopPropagation()}>
                  {onMoveOption && (
                    <>
                      <Tooltip content="上移" side="top" sideOffset={4} disabled={idx === 0}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          aria-label="上移"
                          className="nb-bitable-btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveOption(opt.id, 'up');
                          }}
                          style={{
                            opacity: idx === 0 ? 0.25 : 1,
                            padding: 'var(--dim-3) var(--dim-4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ChevronUp size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip content="下移" side="top" sideOffset={4} disabled={idx === options.length - 1}>
                        <button
                          type="button"
                          disabled={idx === options.length - 1}
                          aria-label="下移"
                          className="nb-bitable-btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveOption(opt.id, 'down');
                          }}
                          style={{
                            opacity: idx === options.length - 1 ? 0.25 : 1,
                            padding: 'var(--dim-3) var(--dim-4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ChevronDown size={13} />
                        </button>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip content="修改选项名称与颜色" side="top" sideOffset={4}>
                    <button
                      type="button"
                      aria-label="修改选项名称与颜色"
                      className="nb-bitable-btn-ghost"
                      onClick={(e) => startEdit(e, opt)}
                      style={{
                        padding: 'var(--dim-3) var(--dim-4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip content="删除选项" side="top" sideOffset={4}>
                    <button
                      type="button"
                      aria-label="删除选项"
                      className="nb-bitable-btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOption?.(opt.id);
                      }}
                      style={{
                        padding: 'var(--dim-3) var(--dim-4)',
                        color: 'var(--nb-red-500)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        })}

        {options.length === 0 && (
          <div style={{ padding: 'var(--dim-10) var(--dim-8)', fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', textAlign: 'center' }}>
            {isMulti ? '暂无多选标签，请在下方创建' : '暂无选项，请在下方创建'}
          </div>
        )}
      </div>

      {/* 新建选项表单：编辑已有选项时收起，避免两套色板并存时点错 */}
      {manageable && onAddOption && !editingId && (
        <div
          style={{
            borderTop: 'var(--dim-1) solid var(--editor-border)',
            paddingTop: 'var(--dim-6)',
            marginTop: 'var(--dim-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-6)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--dim-4)' }}>
            <input
              type="text"
              placeholder="新建标签选项..."
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: 'var(--dim-4) var(--dim-8)',
                fontSize: 'var(--text-12)',
                border: 'var(--dim-1) solid var(--editor-border)',
                borderRadius: 'var(--dim-4)',
                outline: 'none',
                background: 'var(--editor-surface)',
                color: 'var(--editor-text)',
              }}
            />
            <button
              type="button"
              className="nb-bitable-btn-primary"
              onClick={handleAdd}
              style={{
                padding: 'var(--dim-4) var(--dim-10)',
                fontSize: 'var(--text-12)',
              }}
            >
              添加
            </button>
          </div>
          <ColorPickerRow value={newColor} onChange={setNewColor} />
        </div>
      )}
    </FloatingPanel>
  );
}
