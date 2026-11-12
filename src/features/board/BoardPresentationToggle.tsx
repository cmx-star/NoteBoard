// NoteBoard 画板全屏演示悬浮按钮
// 左上角菜单附近热区负责“靠近显示”，按钮本体提供悬停、按压和键盘焦点反馈

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import { useLayoutStore } from '../../stores/layoutStore';

interface BoardPresentationToggleProps {
  /** 当前是否已经进入纯净全屏演示模式 */
  enabled: boolean;
  /** 切换演示模式；只允许修改窗口与布局状态，不能触发文档变更 */
  onToggle: () => void;
}

/**
 * 渲染画板左上角菜单旁的隐形感应热区与全屏切换按钮。
 * 普通与全屏模式都固定显示在三横线菜单右侧，避免覆盖 Excalidraw 靠近时恢复的菜单按钮。
 */
export function BoardPresentationToggle({ enabled, onToggle }: BoardPresentationToggleProps) {
  const [inHotZone, setInHotZone] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const hotZoneRef = useRef<HTMLDivElement>(null);
  // 全屏演示与极窄模式互斥：极窄模式下不提供入口（已在演示中时保留退出按钮）
  const compactMode = useLayoutStore((s) => s.compactMode);

  // 监听全局指针位置，使不可点击的透明热区不会拦截画板自身操作
  useEffect(() => {
    const hotZone = hotZoneRef.current;
    if (!hotZone) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = hotZone.getBoundingClientRect();
      setInHotZone(
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom,
      );
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, []);

  if (compactMode && !enabled) return null;

  const isHighlighted = isHovered || isFocused;
  const isVisible = isHighlighted || inHotZone;
  const tooltipContent = enabled ? '退出全屏演示' : '全屏演示画板';
  const tooltipShortcut = enabled ? 'Esc' : undefined;
  const Icon = enabled ? Minimize2 : Maximize2;

  return (
    <>
      {/* 左上角 112×96 感应区覆盖菜单附近，只负责测距，不接管任何画布指针事件 */}
      <div
        ref={hotZoneRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 'var(--dim-112)',
          height: 'var(--dim-96)',
          zIndex: 'var(--z-29)',
          pointerEvents: 'none',
        }}
      />

      <Tooltip content={tooltipContent} shortcut={tooltipShortcut} side="bottom" sideOffset={6} disabled={!isVisible}>
        <button
          type="button"
          aria-label={tooltipContent}
        aria-pressed={enabled}
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          setIsPressed(false);
        }}
        style={{
          position: 'absolute',
          // 与 Excalidraw 左上角菜单保持同一 16px 顶边和 36px 总尺寸
          top: 'var(--dim-16)',
          left: 'var(--dim-62)',
          zIndex: 'var(--z-30)',
          width: 'var(--dim-36)',
          height: 'var(--dim-36)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          border: isHighlighted
            ? 'var(--dim-1) solid var(--editor-border-focus)'
            : isVisible
              ? 'var(--dim-1) solid var(--editor-border)'
              : 'var(--dim-1) solid transparent',
          background: isPressed
            ? 'var(--toolbar-active)'
            : isHighlighted
              ? 'var(--editor-surface)'
              : 'var(--editor-bg)',
          color: isHighlighted
            ? 'var(--accent-strong)'
            : 'var(--editor-text-secondary)',
          boxShadow: isHighlighted
            ? '0 var(--dim-6) var(--dim-18) var(--nb-black-a18)'
            : isVisible
              ? '0 var(--dim-3) var(--dim-12) var(--nb-black-a10)'
              : 'none',
          opacity: isHighlighted ? 1 : inHotZone ? 0.86 : 0,
          transform: isPressed
            ? 'translateY(0) scale(var(--scale-0-92))'
            : isVisible
              ? 'translateY(0) scale(var(--scale-1))'
              : 'translateY(calc(var(--dim-8) * -1)) scale(var(--scale-0-94))',
          cursor: 'pointer',
          pointerEvents: isVisible ? 'auto' : 'none',
          backdropFilter: 'blur(var(--dim-10))',
          WebkitBackdropFilter: 'blur(var(--dim-10))',
          outline: isFocused ? 'var(--dim-2) solid var(--editor-border-focus)' : 'none',
          outlineOffset: 'var(--dim-2)',
          transition:
            'opacity var(--transition-normal), transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast)',
        }}
      >
        <Icon size={17} strokeWidth={2.1} />
      </button>
    </Tooltip>
  </>
);
}
