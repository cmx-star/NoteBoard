// NoteBoard 思维导图与大纲节点前置图标选择器
// 提供优先级标记 (1~10)、状态徽标与常用 Emoji 选择，全主题自适应
// 详见 docs/09-开发路线图.md

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';

interface MindmapIconPickerProps {
  currentIcon?: string;
  onSelect: (icon: string | undefined) => void;
  onClose: () => void;
  // 弹窗定位坐标
  position?: { x: number; y: number };
}

const ICON_GROUPS = [
  {
    name: '优先级',
    icons: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
    // 十个优先级分两行，每行 5 个
    columns: 5,
  },
  {
    name: '状态标记',
    icons: ['✅', '❌', '❓', '⏳', '⭐️', '🚩'],
  },
  {
    name: '常用标记',
    icons: ['💡', '🔥', '📌', '🎯', '🚀', '📅', '⚡️', '❤️', '👍', '🎉', '⚠️', '🔍'],
  },
];

export function MindmapIconPicker({
  currentIcon,
  onSelect,
  onClose,
  position,
}: MindmapIconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部自动关闭
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const stylePosition: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: Math.max(16, Math.min(window.innerWidth - 240, position.x)),
        top: Math.max(16, Math.min(window.innerHeight - 280, position.y)),
      }
    : {
        position: 'absolute',
        top: 'var(--pct-100)',
        left: 0,
        marginTop: 'var(--dim-4)',
      };

  return (
    <div
      ref={containerRef}
      style={{
        ...stylePosition,
        width: 'var(--dim-220)',
        background: 'var(--editor-surface)',
        border: 'var(--dim-1) solid var(--editor-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 var(--dim-8) var(--dim-24) var(--nb-black-a15)',
        padding: 'var(--dim-10) var(--dim-12)',
        zIndex: 'var(--z-99999)',
        fontSize: 'var(--text-12)',
        color: 'var(--editor-text)',
        userSelect: 'none',
        animation: 'nbFadeIn 0.12s ease-out',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 顶部操作行：当前状态与清除图标 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--dim-8)',
          paddingBottom: 'var(--dim-6)',
          borderBottom: 'var(--dim-1) solid var(--editor-border)',
        }}
      >
        <span style={{ fontSize: 'var(--text-11)', fontWeight: 'var(--weight-600)', color: 'var(--editor-text-secondary)' }}>
          设置节点图标
        </span>
        {currentIcon && (
          <Tooltip content="移除当前图标" side="top" sideOffset={4}>
            <button
              type="button"
              onClick={() => {
                onSelect(undefined);
                onClose();
              }}
              aria-label="移除当前图标"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dim-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-11)',
                color: 'var(--editor-text-muted)',
                padding: 'var(--dim-2) var(--dim-4)',
                borderRadius: 'var(--radius-sm)',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--nb-red-500)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--editor-text-muted)')}
            >
              <X size={11} />
              <span>清除</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* 分组渲染图标 */}
      {ICON_GROUPS.map((group) => (
        <div key={group.name} style={{ marginBottom: 'var(--dim-8)' }}>
          <div
            style={{
              fontSize: 'var(--text-10)',
              color: 'var(--editor-text-muted)',
              marginBottom: 'var(--dim-4)',
            }}
          >
            {group.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${group.columns ?? 6}, 1fr)`, gap: 'var(--dim-4)' }}>
            {group.icons.map((icon) => {
              const isSelected = currentIcon === icon;
              return (
                <button
                  key={icon}
                  type="button"
                  onClick={() => {
                    onSelect(icon);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'var(--dim-28)',
                    fontSize: 'var(--text-15)',
                    border: isSelected
                      ? 'var(--dim-1-5) solid var(--editor-accent)'
                      : 'var(--dim-1) solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected
                      ? 'var(--toolbar-active)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--toolbar-hover)';
                      e.currentTarget.style.transform = 'scale(var(--scale-1-15))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'scale(var(--scale-1))';
                    }
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(var(--scale-0-95))';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(var(--scale-1-15))';
                  }}
                >
                  {icon}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
