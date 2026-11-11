// NoteBoard 顶部操作栏基础 UI 组件集
// 包含：基础按钮、下拉菜单容器、多级子菜单项、调色盘、分割线等
// 严格遵循 Hover、Active、Pressed 状态反馈与主题 Token

import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import { isTouchInteraction } from '../../core/inputModality';
import { formatShortcut } from '../../core/shortcuts';
import { useViewportClamp } from '../../components/useViewportClamp';
import { CustomColorSection } from '../../components/colorPicker/CustomColorPicker';

// ── 基础工具栏按钮 ──

export interface ToolbarButtonProps {
  icon?: ReactNode;
  label?: string;
  title?: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  danger?: boolean;
  hasDropdown?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 顶部操作栏单按钮组件
 * 具备 Hover 底色、Active 高亮、Pressed 微缩动效与 Tooltip 提示
 */
export function ToolbarButton({
  icon,
  label,
  title,
  shortcut,
  active,
  disabled,
  onClick,
  danger,
  hasDropdown,
  style,
}: ToolbarButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // 动态计算背景色与文字颜色
  let background = 'transparent';
  let color = 'var(--editor-text-secondary, var(--editor-text))';
  let border = 'var(--dim-1) solid transparent';

  if (disabled) {
    color = 'var(--editor-text-muted)';
  } else if (active) {
    background = 'var(--editor-selection-background)';
    color = 'var(--accent-500)';
    border = 'var(--dim-1) solid var(--editor-border-focus)';
  } else if (pressed) {
    background = 'var(--toolbar-active)';
  } else if (hovered) {
    if (danger) {
      background = 'var(--nb-auto-ef4444-a12)';
      color = 'var(--nb-red-500)';
    } else {
      background = 'var(--toolbar-hover)';
      color = 'var(--editor-text)';
    }
  }

  return (
    <Tooltip content={title} shortcut={shortcut} disabled={disabled || !title} side="bottom" sideOffset={6}>
      <button
        type="button"
        aria-label={title || label}
        disabled={disabled}
        onMouseDown={(e) => {
          if (!disabled) {
            e.preventDefault();
            setPressed(true);
          }
        }}
        onMouseUp={() => setPressed(false)}
        onClick={(e) => {
          if (!disabled && onClick) {
            onClick(e);
          }
        }}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        style={{
          height: 'var(--dim-28)',
          minWidth: label ? undefined : 28,
          padding: label ? '0 var(--dim-8)' : '0 var(--dim-6)',
          border,
          background,
          color,
          opacity: disabled ? 0.38 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 'var(--text-12)',
          fontFamily: 'var(--ui-font-family, inherit)',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--dim-4)',
          transform: !disabled && pressed ? 'scale(var(--scale-0-93))' : !disabled && hovered ? 'scale(var(--scale-1-04))' : 'scale(var(--scale-1))',
          transition: 'all var(--transition-fast, var(--duration-150) ease)',
          userSelect: 'none',
          flexShrink: 0,
          ...style,
        }}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-14)' }}>{icon}</span>}
        {label && <span style={{ fontWeight: active ? 600 : 450, whiteSpace: 'nowrap' }}>{label}</span>}
        {hasDropdown && (
          <ChevronDown
            size={12}
            strokeWidth={2}
            style={{
              opacity: 'var(--opacity-0-7)',
              marginLeft: label ? 2 : -2,
              transition: 'transform var(--transition-fast)',
            }}
          />
        )}
      </button>
    </Tooltip>
  );
}

// ── 垂直分割线 ──

export function ToolbarDivider() {
  return (
    <div
      style={{
        width: 'var(--dim-1)',
        height: 'var(--dim-16)',
        background: 'var(--editor-border)',
        margin: '0 var(--dim-3)',
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  );
}

// ── 下拉菜单内的水平分组线 ──

export function ToolbarDropdownSeparator() {
  return (
    <div
      role="separator"
      style={{
        height: 'var(--dim-1)',
        margin: 'var(--dim-3) var(--dim-6)',
        background: 'var(--editor-border)',
        flexShrink: 0,
      }}
    />
  );
}

// ── 下拉菜单容器 ──

export interface ToolbarDropdownProps {
  trigger: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}

export function ToolbarDropdown({
  trigger,
  isOpen,
  onOpenChange,
  children,
  align,
  style,
}: ToolbarDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(align ?? 'left');
  // 窄窗口里左右对齐都可能越界，展开后整体平移回窗口内
  const panelClamp = useViewportClamp<HTMLDivElement>(isOpen, effectiveAlign);

  // 计算下拉菜单对齐方式，防止超出编辑区右边界
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    if (align) {
      setEffectiveAlign(align);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const editorPanel = containerRef.current.closest('#nb-editor') || document.body;
    const panelRight = editorPanel.getBoundingClientRect().right;
    // 如果向右展开可能会超出编辑区右边缘，则向左靠齐
    if (rect.left + 190 > panelRight) {
      setEffectiveAlign('right');
    } else {
      setEffectiveAlign('left');
    }
  }, [isOpen, align]);

  // 监听外部点击自动关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [isOpen, onOpenChange]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <div onClick={() => onOpenChange(!isOpen)} style={{ display: 'inline-flex' }}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={panelClamp.ref}
          className="nb-toolbar-dropdown-panel"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(var(--pct-100) + var(--dim-4))',
            ...(effectiveAlign === 'left' ? { left: 0 } : { right: 0 }),
            zIndex: 'var(--z-120)',
            minWidth: 'var(--dim-160)',
            background: 'var(--editor-surface)',
            border: 'var(--dim-1) solid var(--editor-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--dim-4)',
            boxShadow: '0 var(--dim-6) var(--dim-20) var(--nb-black-a16)',
            backdropFilter: 'blur(var(--dim-10))',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-1)',
            animation: 'nb-fade-in var(--duration-120) ease-out',
            ...style,
            ...panelClamp.style,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── 下拉菜单项与多级子菜单 ──

export interface ToolbarDropdownItemProps {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  /** 若包含二级/三级子菜单，传入子菜单组件 */
  submenu?: ReactNode;
  /** 子菜单的大致宽度（用于判断是否向左展开），默认按普通列表子菜单的 170px 计算 */
  submenuWidth?: number;
  /** 点击后是否自动关闭当前下拉菜单 */
  closeOnClick?: boolean;
}

export function ToolbarDropdownItem({
  icon,
  label,
  shortcut,
  active,
  disabled,
  danger,
  onClick,
  submenu,
  submenuWidth = 170,
}: ToolbarDropdownItemProps) {
  const [hovered, setHovered] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [flipLeft, setFlipLeft] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 左右两侧都放不下子菜单时（极窄模式），平移回窗口内并允许覆盖父级菜单
  const submenuClamp = useViewportClamp<HTMLDivElement>(submenuOpen, flipLeft);

  const hasSubmenu = Boolean(submenu);

  let background = 'transparent';
  let color = 'var(--editor-text)';

  if (disabled) {
    color = 'var(--editor-text-muted)';
  } else if (active) {
    background = 'var(--editor-selection-background)';
    color = 'var(--accent-500)';
  } else if (hovered || submenuOpen) {
    if (danger) {
      background = 'var(--nb-auto-ef4444-a12)';
      color = 'var(--nb-red-500)';
    } else {
      background = 'var(--toolbar-hover)';
    }
  }

  // 计算子菜单展开方向：基于编辑区容器 (#nb-editor) 右边界而非整个视口
  const updateSubmenuPosition = () => {
    if (!itemRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const editorPanel = itemRef.current.closest('#nb-editor') || document.body;
    const panelRight = editorPanel.getBoundingClientRect().right;
    const spaceRight = panelRight - rect.right;
    // 右侧剩余空间放不下子菜单时，自动向左侧展开二级子菜单，杜绝被右侧大纲栏或面板边框裁剪
    setFlipLeft(spaceRight < submenuWidth);
  };

  // 鼠标悬停进入（触屏补发的兼容鼠标事件忽略，子菜单改由点击切换，避免"展开即收起"）
  const handleMouseEnter = () => {
    if (disabled || isTouchInteraction()) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setHovered(true);
    if (hasSubmenu) {
      updateSubmenuPosition();
      setSubmenuOpen(true);
    }
  };

  // 鼠标悬停离开（120ms 防抖缓冲，防止划向子菜单时瞬间关闭）
  const handleMouseLeave = () => {
    setHovered(false);
    if (isTouchInteraction()) return;
    if (hasSubmenu) {
      closeTimeoutRef.current = setTimeout(() => {
        setSubmenuOpen(false);
      }, 120);
    }
  };

  // 移动端子菜单在可滚动面板内内联展开：展开后若内容落在面板可视区下方，则把面板滚到可见
  // 桌面端面板不滚动（scrollHeight 不超出），直接跳过
  const revealExpandedSubmenu = () => {
    requestAnimationFrame(() => {
      const item = itemRef.current;
      const panel = item?.closest<HTMLElement>('.nb-toolbar-dropdown-panel');
      if (!item || !panel || panel.scrollHeight <= panel.clientHeight) return;
      const itemRect = item.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const overflowBottom = itemRect.bottom - panelRect.bottom;
      if (overflowBottom <= 0) return;
      // 滚动量不超过条目顶部到面板顶部的距离，避免子菜单过长时把一级项本身滚出视野
      panel.scrollTop += Math.min(overflowBottom + 6, itemRect.top - panelRect.top);
    });
  };

  // 统一点击处理：含子菜单时点击切换展开状态，叶子项点击执行并冒泡
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (hasSubmenu) {
      e.stopPropagation();
      updateSubmenuPosition();
      if (!submenuOpen) revealExpandedSubmenu();
      setSubmenuOpen((prev) => !prev);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={itemRef}
      className="nb-toolbar-dropdown-item"
      data-submenu-open={submenuOpen || undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--dim-5) var(--dim-8)',
        borderRadius: 'var(--radius-sm)',
        background,
        color,
        fontSize: 'var(--text-12)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        transition: 'background var(--transition-fast)',
        whiteSpace: 'nowrap',
      }}
    >
      {/* 左侧图标与标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)', flex: 1 }}>
        {icon && <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-14)' }}>{icon}</span>}
        <span style={{ fontWeight: active ? 600 : 450 }}>{label}</span>
      </div>

      {/* 右侧指示：当前选中 Check、快捷键或子菜单箭头 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)', marginLeft: 'var(--dim-12)' }}>
        {active && !hasSubmenu && <Check size={13} strokeWidth={2.5} color="var(--accent-500)" />}
        {shortcut && (
          <span style={{ fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', opacity: 'var(--opacity-0-8)' }}>
            {/* 与按钮提示共用平台转换，Mac 下显示 Cmd / Option。 */}
            {formatShortcut(shortcut)}
          </span>
        )}
        {hasSubmenu && (
          <ChevronRight
            className="nb-toolbar-submenu-arrow"
            size={13}
            strokeWidth={2}
            style={{
              opacity: 'var(--opacity-0-6)',
              transform: submenuOpen ? (flipLeft ? 'rotate(180deg)' : 'rotate(0deg)') : 'none',
              transition: 'transform var(--transition-fast)',
            }}
          />
        )}
      </div>

      {/* 二级 / 三级悬浮子菜单 */}
      {hasSubmenu && submenuOpen && (
        <div
          ref={submenuClamp.ref}
          className="nb-toolbar-submenu"
          onMouseEnter={() => {
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = null;
            }
            setSubmenuOpen(true);
          }}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 'calc(var(--dim-4) * -1)',
            ...(flipLeft
              ? { right: 'calc(var(--pct-100) + var(--dim-2))' }
              : { left: 'calc(var(--pct-100) + var(--dim-2))' }),
            zIndex: 'var(--z-140)',
            minWidth: 'var(--dim-160)',
            background: 'var(--editor-surface)',
            border: 'var(--dim-1) solid var(--editor-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--dim-4)',
            boxShadow: '0 var(--dim-8) var(--dim-24) var(--nb-black-a18)',
            backdropFilter: 'blur(var(--dim-12))',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-1)',
            animation: 'nb-fade-in var(--duration-100) ease-out',
            ...submenuClamp.style,
          }}
        >
          {/* 透明悬停连桥：覆盖父子菜单间隙，确保鼠标移动不会产生盲区 */}
          <div
            className="nb-toolbar-submenu-bridge"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(flipLeft ? { right: 'calc(var(--dim-6) * -1)', width: 'var(--dim-8)' } : { left: 'calc(var(--dim-6) * -1)', width: 'var(--dim-8)' }),
              pointerEvents: 'auto',
            }}
          />
          {submenu}
        </div>
      )}
    </div>
  );
}

// ── 高亮调色盘组件 ──

export const HIGHLIGHT_COLORS = [
  { name: '柠檬黄', color: 'var(--nb-yellow-200)', border: 'var(--nb-yellow-400)' },
  { name: '清新绿', color: 'var(--nb-green-200)', border: 'var(--nb-green-400)' },
  { name: '天空蓝', color: 'var(--nb-blue-200)', border: 'var(--nb-blue-400)' },
  { name: '浅紫', color: 'var(--nb-purple-200)', border: 'var(--nb-purple-300)' },
  { name: '蜜桃粉', color: 'var(--nb-pink-200)', border: 'var(--nb-pink-400)' },
  { name: '暖阳橙', color: 'var(--nb-orange-200)', border: 'var(--nb-orange-400)' },
  { name: '珊瑚红', color: 'var(--nb-red-200)', border: 'var(--nb-red-400)' },
  { name: '湖水青', color: 'var(--nb-cyan-200)', border: 'var(--nb-cyan-400)' },
];

const HIGHLIGHT_COLOR_VALUES = HIGHLIGHT_COLORS.map((item) => item.color);

export interface HighlightColorPickerProps {
  onSelectColor: (color: string) => void;
  onRemoveHighlight: () => void;
  /** 当前高亮颜色（源码模式等无法读取时不传） */
  activeColor?: string | null;
}

export function HighlightColorPicker({
  onSelectColor,
  onRemoveHighlight,
  activeColor,
}: HighlightColorPickerProps) {
  return (
    <div style={{ padding: 'var(--dim-6) var(--dim-4)', width: 'var(--dim-176)' }}>
      <div style={{ fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', marginBottom: 'var(--dim-6)', paddingLeft: 'var(--dim-4)' }}>
        选择高亮背景颜色
      </div>
      {/* 8 色调色盘色块网格 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--dim-6)',
          marginBottom: 'var(--dim-8)',
        }}
      >
        {HIGHLIGHT_COLORS.map((item) => (
          <Tooltip key={item.color} content={item.name} side="top" sideOffset={4}>
            <button
              type="button"
              onClick={() => onSelectColor(item.color)}
              style={{
                width: 'var(--dim-32)',
                height: 'var(--dim-24)',
                borderRadius: 'var(--radius-sm)',
                background: item.color,
                border: `var(--dim-1) solid ${item.border}`,
                cursor: 'pointer',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(var(--scale-1-15))';
                e.currentTarget.style.boxShadow = '0 var(--dim-2) var(--dim-6) var(--nb-black-a20)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(var(--scale-1))';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </Tooltip>
        ))}
      </div>
      {/* 自定义高亮颜色：固定的颜色可直接选用，「+」展开取色盘 */}
      <div style={{ marginBottom: 'var(--dim-8)' }}>
        <CustomColorSection
          kind="highlight"
          variant="fill"
          activeColor={activeColor}
          presetColors={HIGHLIGHT_COLOR_VALUES}
          onSelect={onSelectColor}
          swatchWidth={32}
          swatchHeight={24}
        />
      </div>
      {/* 清除高亮按钮 */}
      <button
        type="button"
        onClick={onRemoveHighlight}
        style={{
          width: 'var(--pct-100)',
          padding: 'var(--dim-4) var(--dim-6)',
          borderRadius: 'var(--radius-sm)',
          border: 'var(--dim-1) dashed var(--control-border)',
          background: 'transparent',
          color: 'var(--editor-text-secondary)',
          fontSize: 'var(--text-11)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--dim-4)',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--toolbar-hover)';
          e.currentTarget.style.color = 'var(--nb-red-500)';
          e.currentTarget.style.borderColor = 'var(--nb-red-500)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--editor-text-secondary)';
          e.currentTarget.style.borderColor = 'var(--control-border)';
        }}
      >
        清除文本高亮
      </button>
    </div>
  );
}
