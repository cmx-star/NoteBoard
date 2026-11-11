// NoteBoard 多维表格多行文本的编辑弹层
// 单元格空间不足以承载多行内容，双击后在此弹层中编辑：
// 采用「草稿 + 显式提交」而非实时写入，保证一次编辑只产生一条撤销记录

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BitableColumn, LongTextConfig } from './bitableTypes';
import { BitableRichTextEditor, type RichTextMode } from './BitableRichTextEditor';
import { X, Check } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import { KEYBOARD_SCOPE_ATTR, stopReactPropagation } from './bitableUtils';
import { formatShortcut } from '../../core/shortcuts';

interface LongTextPopoverProps {
  /** 所属列，用于取字段名与 Markdown 配置 */
  column: BitableColumn;
  /** 该单元格当前的原始值 */
  value: unknown;
  config: LongTextConfig;
  /** 保存草稿 */
  onCommit: (next: string) => void;
  onClose: () => void;
}

// 容纳与笔记本一致的完整工具栏不折行；窄窗口由 maxWidth 兜底
const PANEL_WIDTH = 720;

/** 事件来自编辑器节点内部的输入框（图表/公式源码、代码块语言、折叠块标题等），而非正文本身 */
function isNestedEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('.ProseMirror') && !!target.closest('input, textarea, select');
}

/** 弹层中心是否被更高层的浮层覆盖（如图表全屏预览、输入弹窗） */
function isPanelCovered(panel: HTMLElement | null): boolean {
  if (!panel) return false;
  const rect = panel.getBoundingClientRect();
  const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return !!topmost && !panel.contains(topmost);
}

export function BitableLongTextPopover({
  column,
  value,
  config,
  onCommit,
  onClose,
}: LongTextPopoverProps) {
  const initial = value === null || value === undefined ? '' : String(value);
  // 草稿：弹层生命周期内独立维护，关闭时不污染文档
  const [draft, setDraft] = useState(initial);
  const [mode, setMode] = useState<RichTextMode>('rich');
  const panelRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);

  /** 统一收口：无论保存还是取消，都只允许触发一次关闭 */
  const finish = (shouldCommit: boolean) => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (shouldCommit && draft !== initial) onCommit(draft);
    onClose();
  };

  /**
   * 键盘监听需要读到最新的 draft，但又不应随每次输入反复解绑重绑
   * 用 ref 转发 finish，使监听器只绑定一次。
   */
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /**
   * 键盘事件挂在 document/window 上以保证浮层内任何位置都生效：
   * 1. Ctrl/⌘+Enter 保存：捕获阶段处理，抢在编辑器「硬换行」快捷键之前；
   * 2. Esc 取消：冒泡阶段处理，先让右键菜单、图片预览、节点内源码框等内层浮层消费，
   *    它们处理过（defaultPrevented / 阻止冒泡）或仍遮挡在弹层之上时不关闭弹层。
   *    富文本正文里的 Esc 总会被 ProseMirror 标记 defaultPrevented，改由编辑器 onEscape 回调处理（见 handleEditorEscape）。
   */
  useEffect(() => {
    const handleSaveKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
      // 图表源码、公式、HTML 块等节点内编辑框自有 Ctrl+Enter「完成」语义
      if (isNestedEditorTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      finishRef.current(true);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (isNestedEditorTarget(e.target)) return;
      if (isPanelCovered(panelRef.current)) return;
      finishRef.current(false);
    };
    document.addEventListener('keydown', handleSaveKey, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleSaveKey, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  /**
   * 富文本正文中的 Esc（斜杠菜单未打开时由编辑器回调）
   * 遮挡判断须在按键当下进行：同一次 Esc 可能正在关闭图表全屏预览等更高层浮层；
   * 关闭延后一拍，避免在 ProseMirror 处理按键途中销毁编辑器。
   */
  const handleEditorEscape = () => {
    if (isPanelCovered(panelRef.current)) return;
    window.setTimeout(() => finishRef.current(false), 0);
  };

  return createPortal(
    <div
      // 遮罩：点击遮罩视为放弃修改，语义与「取消」一致，避免误存
      // Portal 内的事件会沿 React 树冒泡到渲染弹层的单元格/卡片/侧栏，引发选区变化或弹出表格右键菜单（层级低于弹层，显示在遮罩背后）；
      // 只阻断 React 树冒泡，原生事件仍需到达 document，编辑器右键菜单、工具栏下拉才能点空白处关闭
      onMouseDown={(e) => {
        stopReactPropagation(e);
        if (e.target === e.currentTarget) finish(false);
      }}
      onClick={stopReactPropagation}
      onDoubleClick={stopReactPropagation}
      onContextMenu={stopReactPropagation}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-100002)',
        background: 'var(--nb-auto-0f172a-a28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--dim-24)',
      }}
    >
      <div
        ref={panelRef}
        // 键盘隔离区：点击标题栏/底栏空白处焦点留在面板上，表格全局快捷键不会把 Backspace 当成清空单元格
        {...{ [KEYBOARD_SCOPE_ATTR]: '' }}
        tabIndex={-1}
        style={{
          outline: 'none',
          width: PANEL_WIDTH,
          maxWidth: 'var(--pct-100)',
          maxHeight: 'min(72vh, var(--dim-640))',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--editor-surface)',
          border: 'var(--dim-1) solid var(--editor-border)',
          borderRadius: 'var(--dim-10)',
          boxShadow: '0 var(--dim-18) var(--dim-48) var(--nb-auto-0f172a-a22)',
          // 不裁剪溢出：编辑器顶部工具栏的插入菜单及其子菜单需要伸出面板边界
        }}
      >
        {/* 头部：字段名、形态说明与关闭 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--dim-8)',
            padding: 'var(--dim-10) var(--dim-14)',
            borderBottom: 'var(--dim-1) solid var(--editor-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-13)', fontWeight: 'var(--weight-600)', color: 'var(--editor-text)' }}>
              {column.name}
            </div>
            <div style={{ fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', marginTop: 'var(--dim-1)' }}>
              多行文本{config.markdown ? ' · Markdown 富文本' : ''} · Esc 取消 · {formatShortcut('Ctrl+Enter')} 保存
            </div>
          </div>
          <Tooltip content="取消编辑" side="bottom" sideOffset={4}>
            <button
              type="button"
              className="nb-bitable-btn-ghost"
              onClick={() => finish(false)}
              aria-label="取消编辑"
              style={{
                padding: 'var(--dim-3)',
                flexShrink: 0,
              }}
            >
              <X size={15} />
            </button>
          </Tooltip>
        </div>

        {/* 编辑区：Markdown 列走富文本，普通列走纯文本多行输入 */}
        {/* Markdown 编辑器自带滚动区：外层只负责按剩余高度收缩，工具栏与模式切换栏始终可见 */}
        <div
          style={
            config.markdown
              ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
              : { flex: 1, minHeight: 0, overflow: 'auto' }
          }
        >
          {config.markdown ? (
            <BitableRichTextEditor
              value={draft}
              onChange={setDraft}
              mode={mode}
              onModeChange={setMode}
              onEscape={handleEditorEscape}
              autoFocus
              minHeight={220}
            />
          ) : (
            <textarea
              value={draft}
              autoFocus
              placeholder="输入内容，回车换行"
              onChange={(e) => setDraft(e.target.value)}
              style={{
                width: 'var(--pct-100)',
                height: 'var(--dim-220)',
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                padding: 'var(--dim-10) var(--dim-12)',
                fontSize: 'var(--text-13)',
                lineHeight: 'var(--leading-1-6)',
                fontFamily: 'inherit',
                background: 'transparent',
                color: 'var(--editor-text)',
              }}
            />
          )}
        </div>

        {/* 底部：显式提交，避免「点外面到底算不算保存」的歧义 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--dim-8)',
            padding: 'var(--dim-10) var(--dim-14)',
            borderTop: 'var(--dim-1) solid var(--editor-border)',
            background: 'var(--editor-bg)',
            // 面板不再裁剪溢出，底栏自带圆角以贴合面板外形
            borderRadius: '0 0 var(--dim-10) var(--dim-10)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)' }}>
            {draft === initial ? '未做修改' : '有未保存的修改'}
          </span>
          <div style={{ display: 'flex', gap: 'var(--dim-8)' }}>
            <button
              type="button"
              className="nb-bitable-btn-secondary"
              onClick={() => finish(false)}
              style={{ padding: 'var(--dim-5) var(--dim-12)' }}
            >
              取消
            </button>
            <button
              type="button"
              className="nb-bitable-btn-primary"
              onClick={() => finish(true)}
              style={{
                gap: 'var(--dim-5)',
                padding: 'var(--dim-5) var(--dim-14)',
                fontWeight: 'var(--weight-500)',
              }}
            >
              <Check size={13} />
              <span>完成</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
