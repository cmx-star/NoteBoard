// NoteBoard 全局 Toast 悬浮提示层
// 渲染来自 toastStore 的轻量通知

import { useToastStore } from '../stores/toastStore';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    // 全局 Toast 容器：定位在顶部同一高度的水平居中位置，避免遮挡右上角搜索与替换栏
    <div
      style={{
        position: 'fixed',
        top: 'var(--dim-48)',
        left: 'var(--pct-50)',
        transform: 'translateX(calc(var(--pct-50) * -1))',
        // 需高于大图预览（100006）、多维表格长文本弹层（100002）与全局输入弹窗（100010），
        // 否则在这些浮层中复制图片等操作的结果提示会被遮住
        zIndex: 'var(--z-100020)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--dim-8)',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - var(--dim-48))',
      }}
    >
      {toasts.map((toast) => {
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';

        const icon = isError ? (
          <AlertCircle size={16} color="var(--error-500)" style={{ flexShrink: 0 }} />
        ) : isWarning ? (
          <AlertTriangle size={16} color="var(--warning-600)" style={{ flexShrink: 0 }} />
        ) : isSuccess ? (
          <CheckCircle size={16} color="var(--success-600)" style={{ flexShrink: 0 }} />
        ) : (
          <Info size={16} color="var(--editor-accent)" style={{ flexShrink: 0 }} />
        );

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--dim-10)',
              padding: 'var(--dim-10) var(--dim-14)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--editor-surface)',
              border: `var(--dim-1) solid ${
                isWarning
                  ? 'var(--warning-600)'
                  : isError
                  ? 'var(--error-500)'
                  : 'var(--editor-border)'
              }`,
              boxShadow: 'var(--shadow-lg, 0 var(--dim-10) var(--dim-15) calc(var(--dim-3) * -1) var(--nb-black-a10), 0 var(--dim-4) var(--dim-6) calc(var(--dim-4) * -1) var(--nb-black-a10))',
              color: 'var(--editor-text)',
              fontSize: 'var(--text-13)',
              lineHeight: 'var(--leading-1-4)',
              animation: 'nb-toast-in 0.2s ease-out',
            }}
          >
            {icon}
            <span style={{ flex: 1 }}>{toast.message}</span>
            {/* 关闭提示按钮，带 Hover 与 Active 反馈 */}
            <Tooltip content="关闭提示" side="top" sideOffset={4}>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--editor-text-muted)',
                  padding: 'var(--dim-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--editor-text)';
                  e.currentTarget.style.background = 'var(--toolbar-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--editor-text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.background = 'var(--toolbar-active)';
                  e.currentTarget.style.transform = 'scale(var(--scale-0-92))';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.background = 'var(--toolbar-hover)';
                  e.currentTarget.style.transform = 'scale(var(--scale-1))';
                }}
                aria-label="关闭提示"
              >
                <X size={14} />
              </button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
