// NoteBoard MarkdownModeToggle
// Markdown 编辑器左下角模式切换悬浮胶囊：可视化 / 源码模式
// 交互规范：与左右把手 (RailToggle) 一致，默认隐藏 (opacity: 0)，鼠标靠近左下角热区 (0.75) 与悬停 (1) 时平滑显现

import { useEffect, useRef, useState } from 'react';
import { Eye, Code } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';

interface MarkdownModeToggleProps {
  viewMode: 'visual' | 'source';
  onToggle: (mode?: 'visual' | 'source') => void;
}

export function MarkdownModeToggle({ viewMode, onToggle }: MarkdownModeToggleProps) {
  // 是否处于左下角热区内
  const [inHotZone, setInHotZone] = useState(false);
  // 是否直接悬停在胶囊按钮本体上
  const [isHovered, setIsHovered] = useState(false);
  // 是否获得键盘焦点
  const [isFocused, setIsFocused] = useState(false);
  const hotZoneRef = useRef<HTMLDivElement>(null);

  // 悬浮热区检测：鼠标移动靠近左下角 200×120px 区域时唤出
  useEffect(() => {
    const hotZone = hotZoneRef.current;
    if (!hotZone) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = hotZone.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      setInHotZone(inside);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const isHighlighted = isHovered || isFocused;
  const isVisible = isHighlighted || inHotZone;

  // 动态视觉透明度与位移动效（默认 0，靠近热区 0.75，悬停/聚焦 1）
  const opacity = isHighlighted ? 1 : inHotZone ? 0.75 : 0;
  const transform = isHighlighted
    ? 'translateY(0) scale(var(--scale-1))'
    : inHotZone
    ? 'translateY(0) scale(var(--scale-0-98))'
    : 'translateY(var(--dim-6)) scale(var(--scale-0-95))';

  return (
    <>
      {/* 左下角不可见感应热区 200×120px，便于鼠标移向左下角时平滑唤出 */}
      <div
        ref={hotZoneRef}
        className="nb-md-mode-toggle"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 'var(--dim-200)',
          height: 'var(--dim-120)',
          zIndex: 'var(--z-24)',
          pointerEvents: 'none',
        }}
      />

      {/* 悬浮胶囊组件本体 */}
      <div
        className="nb-md-mode-toggle"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'absolute',
          bottom: 'var(--dim-14)',
          left: 'var(--dim-18)',
          zIndex: 'var(--z-25)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--dim-2)',
          padding: 'var(--dim-3)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--editor-surface)',
          border: isHighlighted
            ? 'var(--dim-1) solid var(--editor-border-focus)'
            : inHotZone
            ? 'var(--dim-1) solid var(--editor-border)'
            : 'var(--dim-1) solid transparent',
          boxShadow: isHighlighted
            ? '0 var(--dim-4) var(--dim-14) var(--nb-black-a14)'
            : inHotZone
            ? '0 var(--dim-2) var(--dim-8) var(--nb-black-a08)'
            : 'none',
          backdropFilter: 'blur(var(--dim-8))',
          userSelect: 'none',
          opacity,
          transform,
          pointerEvents: isVisible ? 'auto' : 'none',
          transition:
            'opacity var(--transition-normal), transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
        }}
      >
        {/* 可视化模式按钮 */}
        <Tooltip content="可视化模式 (所见即所得)" side="top" sideOffset={6} disabled={!isVisible}>
          <button
            type="button"
            onClick={() => {
              if (viewMode !== 'visual') onToggle('visual');
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label="切换至可视化模式"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--dim-4)',
              padding: 'var(--dim-4) var(--dim-8)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: 'var(--text-12)',
              fontFamily: 'var(--ui-font-family, inherit)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              background:
                viewMode === 'visual'
                  ? 'var(--tab-active-bg, var(--editor-bg))'
                  : 'transparent',
              color:
                viewMode === 'visual' ? 'var(--editor-text)' : 'var(--editor-text-muted)',
              fontWeight: viewMode === 'visual' ? 500 : 400,
              boxShadow:
                viewMode === 'visual' ? '0 var(--dim-1) var(--dim-3) var(--nb-black-a08)' : 'none',
              outline:
                viewMode === 'visual'
                  ? 'var(--dim-1) solid var(--editor-border-focus)'
                  : 'none',
            }}
            onMouseEnter={(e) => {
              if (viewMode !== 'visual') {
                e.currentTarget.style.background = 'var(--toolbar-hover)';
                e.currentTarget.style.color = 'var(--editor-text)';
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== 'visual') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--editor-text-muted)';
              }
              e.currentTarget.style.transform = 'scale(var(--scale-1))';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = 'var(--toolbar-active)';
              e.currentTarget.style.transform = 'scale(var(--scale-0-94))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background =
                viewMode === 'visual'
                  ? 'var(--tab-active-bg, var(--editor-bg))'
                  : 'var(--toolbar-hover)';
              e.currentTarget.style.transform = 'scale(var(--scale-1))';
            }}
          >
            <Eye size={13} style={{ flexShrink: 0 }} />
            <span>可视化</span>
          </button>
        </Tooltip>

        {/* 源码模式按钮 */}
        <Tooltip content="源码模式 (Markdown 原文)" shortcut="Ctrl+/" side="top" sideOffset={6} disabled={!isVisible}>
          <button
            type="button"
            onClick={() => {
              if (viewMode !== 'source') onToggle('source');
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label="切换至源码模式"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--dim-4)',
              padding: 'var(--dim-4) var(--dim-8)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: 'var(--text-12)',
              fontFamily: 'var(--ui-font-family, inherit)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              background:
                viewMode === 'source'
                  ? 'var(--tab-active-bg, var(--editor-bg))'
                  : 'transparent',
              color:
                viewMode === 'source' ? 'var(--editor-text)' : 'var(--editor-text-muted)',
              fontWeight: viewMode === 'source' ? 500 : 400,
              boxShadow:
                viewMode === 'source' ? '0 var(--dim-1) var(--dim-3) var(--nb-black-a08)' : 'none',
              outline:
                viewMode === 'source'
                  ? 'var(--dim-1) solid var(--editor-border-focus)'
                  : 'none',
            }}
            onMouseEnter={(e) => {
              if (viewMode !== 'source') {
                e.currentTarget.style.background = 'var(--toolbar-hover)';
                e.currentTarget.style.color = 'var(--editor-text)';
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== 'source') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--editor-text-muted)';
              }
              e.currentTarget.style.transform = 'scale(var(--scale-1))';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = 'var(--toolbar-active)';
              e.currentTarget.style.transform = 'scale(var(--scale-0-94))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background =
                viewMode === 'source'
                  ? 'var(--tab-active-bg, var(--editor-bg))'
                  : 'var(--toolbar-hover)';
              e.currentTarget.style.transform = 'scale(var(--scale-1))';
            }}
          >
            <Code size={13} style={{ flexShrink: 0 }} />
            <span>源码</span>
          </button>
        </Tooltip>
      </div>
    </>
  );
}
