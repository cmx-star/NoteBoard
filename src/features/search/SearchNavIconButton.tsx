// 搜索栏匹配项导航的紧凑图标按钮（26×28，带 Hover / Active 反馈）
import type { ReactNode } from 'react';
import { Tooltip } from '../../components/Tooltip';

interface NavIconButtonProps {
  /** Tooltip 文案与无障碍标签 */
  label: string;
  /** Tooltip 中展示的快捷键 */
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}

/** 搜索栏匹配项导航用的紧凑图标按钮（26×28，带 Hover / Active 反馈） */
export function NavIconButton({ label, shortcut, onClick, children }: NavIconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut} side="bottom" sideOffset={4}>
      <button
        type="button"
        onClick={onClick}
        // 阻止 mousedown 默认行为，点击按钮时焦点保留在搜索输入框，便于继续按 Enter 导航
        onMouseDown={(e) => {
          e.preventDefault();
          e.currentTarget.style.background = 'var(--toolbar-active)';
          e.currentTarget.style.transform = 'scale(var(--scale-0-92))';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = 'var(--toolbar-hover)';
          e.currentTarget.style.transform = 'scale(var(--scale-1-08))';
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--toolbar-hover)';
          e.currentTarget.style.color = 'var(--editor-text)';
          e.currentTarget.style.transform = 'scale(var(--scale-1-08))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--editor-text-secondary)';
          e.currentTarget.style.transform = 'scale(var(--scale-1))';
        }}
        style={{
          width: 'var(--dim-26)',
          height: 'var(--dim-28)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: 'var(--editor-text-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
          boxSizing: 'border-box',
          transition: 'all var(--transition-fast)',
        }}
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  );
}
