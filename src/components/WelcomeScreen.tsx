// NoteBoard WelcomeScreen
// 无 tab 时的欢迎页：直接展示的新建格式卡片 + 更多格式展开（布局由设置「全局 → 新建入口」配置）
// 详见 docs/07-UI布局与交互规范.md §11

import React, { useState } from 'react';
import {
  FolderOpen,
  FileSearch,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Archive,
  Star,
  FolderSync,
} from 'lucide-react';
import { useSyncStore } from '../stores/syncStore';
import { formatShortcut } from '../core/shortcuts';
import { getCreateFormat, type CreateFormatId } from '../features/welcome/createFormats';
import { useCreateFormats } from '../features/welcome/useCreateFormats';
import { useLayoutStore } from '../stores/layoutStore';
import { Tooltip } from './Tooltip';
import { CodeBadge } from './CodeBadge';

interface WelcomeScreenProps {
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onOpenStaging?: () => void;
  onOpenFavorites?: () => void;
  onNewMarkdown?: () => void;
  onNewText?: () => void;
  onNewMindmap?: () => void;
  onTextDiff?: () => void;
  onNewBoard?: () => void;
  onNewDrawio?: () => void;
  onNewBitable?: () => void;
  onNewMermaid?: () => void;
  onNewPlantUml?: () => void;
  onNewInfographic?: () => void;
  onNewJson?: () => void;
  onNewSql?: () => void;
  /** 打开多端同步文件夹（设置了同步文件夹时显示入口） */
  onOpenSyncFolder?: () => void;
}

// 卡片内名称居左、徽标靠右同处一行：固定一行高度并允许换行、裁掉第二行，
// 空间不足时徽标整体换到被裁掉的第二行而隐藏，不会被挤成「.」，名称优先完整显示
const LABEL_ROW_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: 'var(--dim-12)',
  height: 'var(--dim-18)',
  overflow: 'hidden',
};

// 名称：单独占满一行时仍超宽则省略号截断
const LABEL_TEXT_STYLE: React.CSSProperties = {
  minWidth: 0,
  maxWidth: 'var(--pct-100)',
  fontWeight: 'var(--weight-500)',
  lineHeight: 'var(--dim-18)',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
};

export function WelcomeScreen({
  onOpenFile,
  onOpenFolder,
  onOpenStaging,
  onOpenFavorites,
  onNewMarkdown,
  onNewText,
  onNewMindmap,
  onTextDiff,
  onNewBoard,
  onNewDrawio,
  onNewBitable,
  onNewMermaid,
  onNewPlantUml,
  onNewInfographic,
  onNewJson,
  onNewSql,
  onOpenSyncFolder,
}: WelcomeScreenProps) {
  const [showMoreFormats, setShowMoreFormats] = useState(false);
  // 极窄模式：新建卡片改为图标在上的紧凑三列，描述移入 Tooltip，打开类卡片隐藏快捷键徽标
  const compact = useLayoutStore((s) => s.compactMode);
  // 设置了同步文件夹时显示入口
  const syncRoot = useSyncStore((s) => s.config?.sync.rootDir?.trim() || null);

  // 仅展示新建入口不代表用户要打开编辑器；实际新建/打开动作仍会与读文件并行预取目标内核。

  // 新建格式布局与「+」菜单共用一份设置：直接展示的排入核心卡片网格，其余收进「更多格式」
  const createFormats = useCreateFormats();
  const createHandlers: Record<CreateFormatId, (() => void) | undefined> = {
    markdown: onNewMarkdown,
    text: onNewText,
    bitable: onNewBitable,
    board: onNewBoard,
    mindmap: onNewMindmap,
    textdiff: onTextDiff,
    drawio: onNewDrawio,
    infographic: onNewInfographic,
    mermaid: onNewMermaid,
    plantuml: onNewPlantUml,
    json: onNewJson,
    sql: onNewSql,
  };
  const toCreateAction = (id: CreateFormatId) => {
    const meta = getCreateFormat(id);
    return {
      id,
      icon: meta.icon,
      name: meta.name,
      ext: meta.ext,
      desc: meta.desc,
      color: 'var(--editor-accent)',
      onClick: createHandlers[id],
    };
  };

  // 常用新建操作列表（直接展示的格式，排入 3 列网格）
  const primaryCreateActions = createFormats.primary.map(toCreateAction);

  // 打开与常用操作列表（4 个操作，整齐排成 2x2 网格）
  // 统一使用主题强调色与中性表面，避免高饱和多色描边破坏整体色系
  const openActions = [
    {
      icon: FileSearch,
      label: '打开文件',
      shortcut: 'Ctrl+O',
      color: 'var(--editor-accent)',
      bg: 'var(--editor-surface)',
      border: 'var(--editor-border)',
      hoverBg: 'var(--toolbar-hover)',
      hoverBorder: 'var(--editor-border-focus)',
      iconBg: 'color-mix(in srgb, var(--editor-accent) var(--pct-10), transparent)',
      badgeTint: 'var(--accent-strong)',
      onClick: onOpenFile,
    },
    {
      icon: FolderOpen,
      label: '打开文件夹',
      shortcut: 'Ctrl+Shift+O',
      color: 'var(--editor-accent)',
      bg: 'var(--editor-surface)',
      border: 'var(--editor-border)',
      hoverBg: 'var(--toolbar-hover)',
      hoverBorder: 'var(--editor-border-focus)',
      iconBg: 'color-mix(in srgb, var(--editor-accent) var(--pct-10), transparent)',
      badgeTint: 'var(--accent-strong)',
      onClick: onOpenFolder,
    },
    {
      icon: Star,
      iconFill: 'currentColor',
      label: '打开收藏夹',
      shortcut: '',
      color: 'var(--editor-accent)',
      bg: 'var(--editor-surface)',
      border: 'var(--editor-border)',
      hoverBg: 'var(--toolbar-hover)',
      hoverBorder: 'var(--editor-border-focus)',
      iconBg: 'color-mix(in srgb, var(--editor-accent) var(--pct-10), transparent)',
      badgeTint: 'var(--accent-strong)',
      onClick: onOpenFavorites,
    },
    {
      icon: Archive,
      label: '打开暂存区',
      shortcut: '',
      color: 'var(--editor-accent)',
      bg: 'var(--editor-surface)',
      border: 'var(--editor-border)',
      hoverBg: 'var(--toolbar-hover)',
      hoverBorder: 'var(--editor-border-focus)',
      iconBg: 'color-mix(in srgb, var(--editor-accent) var(--pct-10), transparent)',
      badgeTint: 'var(--accent-strong)',
      onClick: onOpenStaging,
    },
  ];

  // 更多格式列表（收进「更多」的格式）
  const moreFormats = createFormats.more.map(toCreateAction);

  return (
    <div
      style={{
        width: 'var(--pct-100)',
        height: 'var(--pct-100)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? 'var(--dim-20) var(--dim-14)' : 'var(--dim-32) var(--dim-24)',
        boxSizing: 'border-box',
        background: 'var(--editor-bg)',
        color: 'var(--editor-text)',
        fontFamily: 'var(--content-font-family)',
        overflowY: 'auto',
      }}
    >
      {/* 顶部 Logo 与名称 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: compact ? 8 : 12,
          marginBottom: compact ? 18 : 26,
        }}
      >
        <img
          src="/logo.ico"
          alt="NoteBoard"
          width={compact ? 44 : 64}
          height={compact ? 44 : 64}
          style={{ filter: 'drop-shadow(0 var(--dim-4) var(--dim-12) var(--nb-black-a12))' }}
        />
        <h1
          style={{
            fontSize: compact ? 20 : 26,
            fontWeight: 'var(--weight-600)',
            color: 'var(--editor-heading)',
            margin: 0,
            letterSpacing: '-var(--em-0-02)',
          }}
        >
          NoteBoard
        </h1>
      </div>

      {/* 第一部分：常用新建核心卡片区（3 列网格；全部收进更多时不渲染） */}
      {primaryCreateActions.length > 0 && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: compact ? 8 : 12,
          width: 'var(--pct-100)',
          maxWidth: 'var(--dim-840)',
        }}
      >
        {primaryCreateActions.map((action) => (
          <Tooltip key={action.id} content={action.desc} disabled={!compact} side="bottom" sideOffset={6}>
          <button
            type="button"
            className="nb-btn-card"
            onClick={action.onClick ?? (() => {})}
            style={{
              display: 'flex',
              flexDirection: compact ? 'column' : 'row',
              alignItems: 'center',
              gap: compact ? 6 : 12,
              padding: compact ? 'var(--dim-10) var(--dim-6) var(--dim-8)' : 'var(--dim-10) var(--dim-14)',
              // 去掉描述后保持原有卡片高度
              minHeight: compact ? undefined : 57,
              minWidth: 0,
              border: 'var(--dim-1) solid var(--control-border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--editor-surface)',
              cursor: 'pointer',
              fontSize: 'var(--text-13)',
              color: 'var(--editor-text)',
              boxShadow: 'var(--shadow-sm, 0 var(--dim-1) var(--dim-3) var(--nb-black-a04))',
              transition: 'all var(--transition-fast, var(--duration-150) ease)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--toolbar-hover)';
              e.currentTarget.style.borderColor = 'var(--editor-border-focus)';
              e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--editor-surface)';
              e.currentTarget.style.borderColor = 'var(--control-border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(var(--scale-0-98))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
            }}
          >
            {/* 图标容器 */}
            <div
              style={{
                width: 'var(--dim-32)',
                height: 'var(--dim-32)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--editor-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <action.icon size={18} color={action.color} />
            </div>
            {/* 名称 + 扩展名徽标（极窄模式只保留居中名称） */}
            <div style={compact ? { ...LABEL_ROW_STYLE, flex: 'none', width: 'var(--pct-100)', justifyContent: 'center' } : LABEL_ROW_STYLE}>
              <span style={compact ? { ...LABEL_TEXT_STYLE, fontSize: 'var(--text-12)' } : LABEL_TEXT_STYLE}>{action.name}</span>
              {action.ext && !compact && <CodeBadge>{action.ext}</CodeBadge>}
            </div>
          </button>
          </Tooltip>
        ))}
      </div>
      )}

      {/* 第二部分：横在中间的“更多格式”折叠通栏按钮（没有收进更多的格式时不渲染） */}
      {moreFormats.length > 0 && (
      <div
        style={{
          width: 'var(--pct-100)',
          maxWidth: 'var(--dim-840)',
          marginTop: primaryCreateActions.length > 0 ? 12 : 0,
        }}
      >
        <button
          type="button"
          onClick={() => setShowMoreFormats((prev) => !prev)}
          style={{
            width: 'var(--pct-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--dim-8)',
            padding: 'var(--dim-8) var(--dim-16)',
            border: showMoreFormats ? 'var(--dim-1) solid var(--editor-border-focus)' : 'var(--dim-1) solid var(--editor-border)',
            borderRadius: 'var(--radius-lg)',
            background: showMoreFormats ? 'var(--toolbar-hover)' : 'var(--editor-surface)',
            cursor: 'pointer',
            fontSize: 'var(--text-12)',
            color: 'var(--editor-text)',
            transition: 'all var(--transition-fast, var(--duration-150) ease)',
            boxShadow: 'var(--shadow-sm, 0 var(--dim-1) var(--dim-2) var(--nb-black-a03))',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--toolbar-hover)';
            e.currentTarget.style.borderColor = 'var(--editor-border-focus)';
            e.currentTarget.style.transform = 'translateY(calc(var(--dim-0-5) * -1))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = showMoreFormats ? 'var(--toolbar-hover)' : 'var(--editor-surface)';
            e.currentTarget.style.borderColor = showMoreFormats ? 'var(--editor-border-focus)' : 'var(--editor-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(var(--scale-0-99))';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(var(--scale-1))';
          }}
        >
          <Sparkles size={14} color="var(--editor-accent)" />
          <span style={{ fontWeight: 'var(--weight-500)' }}>
            {showMoreFormats ? '收起更多格式' : '更多格式新建'}
          </span>
          {showMoreFormats ? (
            <ChevronUp size={14} color="var(--editor-text-muted)" />
          ) : (
            <ChevronDown size={14} color="var(--editor-text-muted)" />
          )}
        </button>
      </div>
      )}

      {/* 第三部分：展开的更多格式卡片区（3 列网格） */}
      {showMoreFormats && moreFormats.length > 0 && (
        <div
          style={{
            marginTop: 'var(--dim-10)',
            width: 'var(--pct-100)',
            maxWidth: 'var(--dim-840)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: compact ? 6 : 10,
            padding: compact ? 8 : 12,
            background: 'var(--editor-surface)',
            border: 'var(--dim-1) solid var(--editor-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            boxSizing: 'border-box',
          }}
        >
          {moreFormats.map((fmt) => (
            <Tooltip key={fmt.id} content={fmt.desc} disabled={!compact} side="bottom" sideOffset={6}>
            <button
              type="button"
              onClick={fmt.onClick ?? (() => {})}
              style={{
                display: 'flex',
                flexDirection: compact ? 'column' : 'row',
                alignItems: 'center',
                gap: compact ? 4 : 10,
                padding: compact ? 'var(--dim-8) var(--dim-4) var(--dim-6)' : 'var(--dim-8) var(--dim-12)',
                // 去掉描述后保持原有卡片高度
                minHeight: compact ? undefined : 52,
                minWidth: 0,
                border: 'var(--dim-1) solid var(--control-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--editor-bg)',
                cursor: 'pointer',
                fontSize: 'var(--text-12)',
                color: 'var(--editor-text)',
                textAlign: 'left',
                transition: 'all var(--transition-fast, var(--duration-150) ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--toolbar-hover)';
                e.currentTarget.style.borderColor = 'var(--editor-border-focus)';
                e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--editor-bg)';
                e.currentTarget.style.borderColor = 'var(--control-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(var(--scale-0-98))';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
              }}
            >
              <fmt.icon size={16} color={fmt.color} style={{ flexShrink: 0 }} />
              {/* 名称 + 扩展名徽标（极窄模式只保留居中名称） */}
              <div style={compact ? { ...LABEL_ROW_STYLE, flex: 'none', width: 'var(--pct-100)', justifyContent: 'center' } : LABEL_ROW_STYLE}>
                <span style={LABEL_TEXT_STYLE}>{fmt.name}</span>
                {fmt.ext && !compact && <CodeBadge>{fmt.ext}</CodeBadge>}
              </div>
            </button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* 第四部分：打开与常用操作区（2x2 网格，整齐 2 行 2 列，专属微色调背景） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: compact ? 8 : 12,
          width: 'var(--pct-100)',
          maxWidth: 'var(--dim-840)',
          marginTop: compact ? 8 : 12,
        }}
      >
        {openActions.map((action, i) => (
          <button
            key={i}
            type="button"
            className="nb-btn-card"
            onClick={action.onClick ?? (() => {})}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 8 : 12,
              padding: compact ? 'var(--dim-8) var(--dim-10)' : 'var(--dim-10) var(--dim-14)',
              // 去掉描述后保持原有卡片高度
              minHeight: compact ? undefined : 57,
              minWidth: 0,
              border: `var(--dim-1) solid ${action.border}`,
              borderRadius: 'var(--radius-lg)',
              background: action.bg,
              cursor: 'pointer',
              fontSize: 'var(--text-13)',
              color: 'var(--editor-text)',
              boxShadow: 'var(--shadow-sm, 0 var(--dim-1) var(--dim-3) var(--nb-black-a03))',
              transition: 'all var(--transition-fast, var(--duration-150) ease)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = action.hoverBg;
              e.currentTarget.style.borderColor = action.hoverBorder;
              e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = action.bg;
              e.currentTarget.style.borderColor = action.border;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(var(--scale-0-98))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
            }}
          >
            {/* 图标容器（带主题协调的轻底色） */}
            <div
              style={{
                width: 'var(--dim-32)',
                height: 'var(--dim-32)',
                borderRadius: 'var(--radius-md)',
                background: action.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <action.icon
                size={18}
                color={action.color}
                fill={action.iconFill || 'none'}
              />
            </div>
            {/* 标题 + 靠右的快捷键徽标（放不下时徽标隐藏，标题优先完整） */}
            <div style={LABEL_ROW_STYLE}>
              <span style={LABEL_TEXT_STYLE}>{action.label}</span>
              {action.shortcut && !compact ? (
                <CodeBadge color={action.badgeTint}>{formatShortcut(action.shortcut)}</CodeBadge>
              ) : null}
            </div>
          </button>
        ))}

        {/* 设置了同步文件夹时显示：横跨两列 */}
        {syncRoot && onOpenSyncFolder ? (
          <button
            type="button"
            className="nb-btn-card"
            onClick={onOpenSyncFolder}
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 8 : 12,
              padding: compact ? 'var(--dim-8) var(--dim-10)' : 'var(--dim-10) var(--dim-14)',
              // 去掉描述后保持原有卡片高度
              minHeight: compact ? undefined : 57,
              minWidth: 0,
              border: 'var(--dim-1) solid color-mix(in srgb, var(--editor-accent) var(--pct-22), var(--editor-border))',
              borderRadius: 'var(--radius-lg)',
              background: 'color-mix(in srgb, var(--editor-accent) var(--pct-6), var(--editor-surface))',
              cursor: 'pointer',
              fontSize: 'var(--text-13)',
              color: 'var(--editor-text)',
              boxShadow: 'var(--shadow-sm, 0 var(--dim-1) var(--dim-3) var(--nb-black-a03))',
              transition: 'all var(--transition-fast, var(--duration-150) ease)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--editor-accent) var(--pct-12), var(--editor-surface))';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--editor-accent) var(--pct-40), var(--editor-border))';
              e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--editor-accent) var(--pct-6), var(--editor-surface))';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--editor-accent) var(--pct-22), var(--editor-border))';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(var(--scale-0-99))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
            }}
          >
            <div
              style={{
                width: 'var(--dim-32)',
                height: 'var(--dim-32)',
                borderRadius: 'var(--radius-md)',
                background: 'color-mix(in srgb, var(--editor-accent) var(--pct-12), transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FolderSync size={18} color="var(--editor-accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0, fontWeight: 'var(--weight-500)', lineHeight: 'var(--leading-1-3)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              打开同步文件夹
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}

