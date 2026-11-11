// NoteBoard 超链接插入与编辑模态弹窗
// 支持展示名称（展示名）与链接地址（URL）双输入框、已有链接回显与移除、键盘快捷键支持

import { useState, useEffect, useRef } from 'react';
import { Link, Link2, Type, X, Trash2, Check } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';

export interface LinkModalProps {
  /** 弹窗是否可见 */
  isOpen: boolean;
  /** 初始展示文本（如当前选中文本） */
  initialText?: string;
  /** 初始链接地址（如已有链接 href） */
  initialUrl?: string;
  /** 是否为编辑已有链接模式 */
  isEditing?: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 确认提交回调 */
  onConfirm: (data: { text: string; url: string }) => void;
  /** 移除链接回调 */
  onRemove?: () => void;
}

/** 现代化超链接编辑与插入模态弹窗组件 */
export function LinkModal({
  isOpen,
  initialText = '',
  initialUrl = '',
  isEditing = false,
  onClose,
  onConfirm,
  onRemove,
}: LinkModalProps) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);

  const textInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // 弹窗打开或属性变化时同步初始值并自动聚焦
  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setUrl(initialUrl);

      // 延迟微任务聚焦，避免与弹窗挂载动效冲突
      setTimeout(() => {
        if (initialText.trim() && !initialUrl.trim()) {
          urlInputRef.current?.focus();
          urlInputRef.current?.select();
        } else {
          textInputRef.current?.focus();
          textInputRef.current?.select();
        }
      }, 50);
    }
  }, [isOpen, initialText, initialUrl]);

  // 全局 Escape 快捷键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 提交处理
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      // 若 URL 为空且处于编辑模式，视为移除链接
      if (isEditing && onRemove) {
        onRemove();
      }
      onClose();
      return;
    }
    onConfirm({
      text: text.trim(),
      url: trimmedUrl,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-9995)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--nb-black-a45)',
        // 链接编辑与鼠标悬停只更新弹窗内容，不触发整窗背景虚化。
      }}
      onMouseDown={(e) => {
        // 点击遮罩空白区域关闭
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: 'var(--dim-440)',
          maxWidth: '92vw',
          background: 'var(--editor-surface)',
          border: 'var(--dim-1) solid var(--editor-border)',
          borderRadius: 'var(--radius-lg, var(--dim-8))',
          boxShadow: '0 var(--dim-12) var(--dim-32) calc(var(--dim-4) * -1) var(--nb-black-a18), 0 var(--dim-4) var(--dim-12) calc(var(--dim-2) * -1) var(--nb-black-a08)',
          overflow: 'hidden',
          color: 'var(--editor-text)',
          fontFamily: 'var(--ui-font-family, sans-serif)',
          fontSize: 'var(--ui-font-size, var(--dim-13))',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--dim-12) var(--dim-16)',
            borderBottom: 'var(--dim-1) solid var(--editor-border)',
            background: 'var(--editor-bg)',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-8)' }}>
            <Link size={16} style={{ color: 'var(--accent-500)' }} />
            <span style={{ fontWeight: 'var(--weight-600)', fontSize: 'var(--text-14)' }}>
              {isEditing ? '编辑超链接' : '插入超链接'}
            </span>
          </div>
          <Tooltip content="关闭 (Esc)" side="bottom" sideOffset={4}>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--editor-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--dim-4)',
                borderRadius: 'var(--radius-sm, var(--dim-4))',
                transition: 'all var(--transition-fast, var(--duration-150) ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--toolbar-hover)';
                e.currentTarget.style.color = 'var(--editor-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--editor-text-muted)';
              }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {/* 表单输入区域 */}
        <form onSubmit={handleSubmit} style={{ padding: 'var(--dim-16)', display: 'flex', flexDirection: 'column', gap: 'var(--dim-14)' }}>
          {/* 展示名称（展示名） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-6)' }}>
            <label
              style={{
                fontSize: 'var(--text-12)',
                fontWeight: 'var(--weight-500)',
                color: 'var(--editor-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dim-5)',
              }}
            >
              <Type size={13} style={{ opacity: 'var(--opacity-0-8)' }} />
              <span>展示名称（选填）</span>
            </label>
            <input
              ref={textInputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入链接要显示的文本（留空则默认使用链接地址）"
              style={{
                width: 'var(--pct-100)',
                height: 'var(--dim-34)',
                padding: '0 var(--dim-10)',
                border: 'var(--dim-1) solid var(--editor-border)',
                borderRadius: 'var(--radius-md, var(--dim-6))',
                background: 'var(--editor-bg)',
                color: 'var(--editor-text)',
                fontSize: 'var(--text-13)',
                outline: 'none',
                transition: 'border-color var(--transition-fast, var(--duration-150) ease), box-shadow var(--transition-fast, var(--duration-150) ease)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-500)';
                e.currentTarget.style.boxShadow = '0 0 0 var(--dim-2) var(--nb-auto-3b82f6-a20)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--editor-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* 链接地址（URL） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-6)' }}>
            <label
              style={{
                fontSize: 'var(--text-12)',
                fontWeight: 'var(--weight-500)',
                color: 'var(--editor-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dim-5)',
              }}
            >
              <Link2 size={13} style={{ opacity: 'var(--opacity-0-8)' }} />
              <span>链接地址 (URL)</span>
            </label>
            <input
              ref={urlInputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... 或相对路径文档如 ./doc.md"
              style={{
                width: 'var(--pct-100)',
                height: 'var(--dim-34)',
                padding: '0 var(--dim-10)',
                border: 'var(--dim-1) solid var(--editor-border)',
                borderRadius: 'var(--radius-md, var(--dim-6))',
                background: 'var(--editor-bg)',
                color: 'var(--editor-text)',
                fontSize: 'var(--text-13)',
                outline: 'none',
                transition: 'border-color var(--transition-fast, var(--duration-150) ease), box-shadow var(--transition-fast, var(--duration-150) ease)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-500)';
                e.currentTarget.style.boxShadow = '0 0 0 var(--dim-2) var(--nb-auto-3b82f6-a20)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--editor-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* 底部按钮栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isEditing && onRemove ? 'space-between' : 'flex-end',
              marginTop: 'var(--dim-4)',
              paddingTop: 'var(--dim-10)',
              borderTop: 'var(--dim-1) solid var(--editor-border)',
            }}
          >
            {/* 移除链接按钮 */}
            {isEditing && onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--dim-4)',
                  padding: 'var(--dim-5) var(--dim-10)',
                  background: 'transparent',
                  border: 'var(--dim-1) solid var(--nb-auto-ef4444-a30)',
                  color: 'var(--nb-red-500)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  cursor: 'pointer',
                  fontSize: 'var(--text-12)',
                  fontWeight: 'var(--weight-500)',
                  transition: 'all var(--transition-fast, var(--duration-150) ease)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--nb-auto-ef4444-a10)';
                  e.currentTarget.style.borderColor = 'var(--nb-red-500)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--nb-auto-ef4444-a30)';
                }}
              >
                <Trash2 size={13} />
                <span>移除链接</span>
              </button>
            )}

            {/* 取消与确认按钮组 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-8)' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: 'var(--dim-5) var(--dim-14)',
                  background: 'transparent',
                  border: 'var(--dim-1) solid var(--control-border)',
                  color: 'var(--editor-text)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  cursor: 'pointer',
                  fontSize: 'var(--text-12)',
                  fontWeight: 'var(--weight-500)',
                  transition: 'all var(--transition-fast, var(--duration-150) ease)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--toolbar-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                取消
              </button>

              <button
                type="submit"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--dim-4)',
                  padding: 'var(--dim-5) var(--dim-16)',
                  background: 'var(--accent-500)',
                  border: 'var(--dim-1) solid transparent',
                  color: 'var(--nb-white)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  cursor: 'pointer',
                  fontSize: 'var(--text-12)',
                  fontWeight: 'var(--weight-500)',
                  boxShadow: '0 var(--dim-1) var(--dim-2) 0 var(--nb-black-a05)',
                  transition: 'all var(--transition-fast, var(--duration-150) ease)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(calc(var(--dim-0-5) * -1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Check size={13} />
                <span>{isEditing ? '保存' : '插入'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
