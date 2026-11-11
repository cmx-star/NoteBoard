// NoteBoard Infographic TipTap 扩展
// 自研 infographicBlock 节点 + 视口门控 + 就地编辑 + 模板选择 + 全屏缩放预览
// 信息图是纯 DOM 渲染，对外只产出图片：复制/导出 SVG 矢量图或 PNG 位图

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Maximize2, Edit2, AlertCircle, Sparkles, ChevronDown } from 'lucide-react';
import { parseInfographicCode } from '../infographic/infographicParser';
import { InfographicRenderer } from '../infographic/infographicRenderer';
import { InfographicTemplateIcon } from '../infographic/infographicTemplateIcon';
import { INFOGRAPHIC_TEMPLATES } from '../infographic/infographicTemplates';
import { observe } from './viewportActivation';
import { ChartExportMenu } from '../export/ChartExportMenu';
import { DiagramFullscreenModal } from './DiagramFullscreenModal';
import { buildExportFileName, type ChartImageSource } from '../export/chartExport';
import { Tooltip } from '../../components/Tooltip';
import { InfographicBlockCore } from './infographicCore';

/** Infographic 交互微反馈样式注入（支持 Hover 与 Active 动效反馈） */
const INFOGRAPHIC_STYLES = `
/* 顶部操作小图标按钮反馈 */
.nb-info-icon-btn {
  background: transparent;
  border: var(--dim-1) solid transparent;
  cursor: pointer;
  padding: var(--dim-3) var(--dim-6);
  border-radius: var(--radius-sm);
  color: var(--editor-text-muted);
  display: inline-flex;
  align-items: center;
  gap: var(--dim-4);
  font-size: var(--dim-11);
  transition: all 0.15s ease;
  user-select: none;
}
.nb-info-icon-btn:hover {
  background: var(--toolbar-hover);
  color: var(--editor-text);
  border-color: var(--editor-border);
}
.nb-info-icon-btn:active {
  background: var(--toolbar-active);
  transform: scale(var(--scale-0-95));
}

/* 预设模板触发按钮反馈 */
.nb-info-tmpl-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--dim-4);
  padding: var(--dim-2) var(--dim-8);
  border-radius: var(--radius-sm);
  border: var(--dim-1) solid var(--editor-border);
  background: var(--editor-surface);
  color: var(--editor-accent);
  font-size: var(--dim-11);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.nb-info-tmpl-trigger:hover {
  background: var(--nb-auto-3b82f6-a8);
  border-color: var(--editor-accent);
}
.nb-info-tmpl-trigger:active {
  background: var(--nb-auto-3b82f6-a16);
  transform: scale(var(--scale-0-96));
}

/* 下拉菜单项反馈 */
.nb-info-dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--dim-8);
  width: var(--pct-100);
  text-align: left;
  padding: var(--dim-6) var(--dim-10);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--dim-12);
  color: var(--editor-text);
  border-bottom: var(--dim-1) solid var(--editor-border);
  transition: all 0.15s ease;
  user-select: none;
}
.nb-info-dropdown-item:last-child {
  border-bottom: none;
}
.nb-info-dropdown-item:hover {
  background: var(--toolbar-hover);
}
.nb-info-dropdown-item:active {
  background: var(--toolbar-active);
  transform: scale(var(--scale-0-985));
}

/* 主操作按钮（完成） */
.nb-info-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--dim-3) var(--dim-10);
  border-radius: var(--radius-sm);
  background: var(--editor-accent);
  color: var(--nb-white);
  border: var(--dim-1) solid transparent;
  font-size: var(--dim-12);
  cursor: pointer;
  font-weight: var(--weight-500);
  transition: all 0.15s ease;
  user-select: none;
}
.nb-info-btn-primary:hover {
  background: var(--nb-blue-600);
  box-shadow: 0 var(--dim-2) var(--dim-6) var(--nb-auto-2563eb-a30);
}
.nb-info-btn-primary:active {
  background: var(--nb-blue-700);
  transform: scale(var(--scale-0-96));
}

/* 次要操作按钮（取消） */
.nb-info-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--dim-3) var(--dim-8);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--editor-text-muted);
  border: var(--dim-1) solid var(--editor-border);
  font-size: var(--dim-12);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.nb-info-btn-secondary:hover {
  background: var(--toolbar-hover);
  color: var(--editor-text);
  border-color: var(--nb-slate-300);
}
.nb-info-btn-secondary:active {
  background: var(--toolbar-active);
  transform: scale(var(--scale-0-96));
}
`;

function InfographicComponent({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // 关闭回调保持稳定引用，避免弹窗内 Esc 监听反复重绑
  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  // 内联与全屏两套渲染节点分别登记：信息图是纯 DOM 渲染，导出时抓取对应快照。
  // 用 state 保存 DOM 节点，挂载/卸载能触发重渲染，按钮禁用态才跟得上。
  const [inlineEl, setInlineEl] = useState<HTMLDivElement | null>(null);
  const [fullscreenEl, setFullscreenEl] = useState<HTMLDivElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 进入编辑时聚焦源码框：否则焦点仍在编辑器且整块处于节点选中，首次按键会把整个信息图替换掉
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const code = node.attrs.code || '';

  // 解析当前代码
  const { data, error } = parseInfographicCode(code);

  // 导出来源：解析成功且对应渲染节点已挂载才可用
  const activeEl = fullscreen ? fullscreenEl : inlineEl;
  const exportSource: ChartImageSource | null =
    !error && data && activeEl ? { kind: 'element', element: activeEl } : null;
  const exportFileName = buildExportFileName('', 'infographic');

  // 视口门控优化监听挂载
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const unobserve = observe(el, () => {}, { once: true });
    return unobserve;
  }, []);

  // 点击外部自动关闭下拉模板选择面板
  useEffect(() => {
    if (!showTemplateDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as unknown as globalThis.Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showTemplateDropdown]);

  if (editing) {
    return (
      <NodeViewWrapper as="div" style={{ display: 'block', margin: 'var(--dim-14) 0' }}>
        <style>{INFOGRAPHIC_STYLES}</style>
        <div
          style={{
            border: 'var(--dim-1) solid var(--editor-accent)',
            borderRadius: 'var(--radius-md, var(--dim-8))',
            background: 'var(--editor-surface)',
            overflow: 'visible',
            boxShadow: '0 var(--dim-6) var(--dim-16) var(--nb-black-a08)',
            position: 'relative',
          }}
        >
          {/* 编辑态顶部工具栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--dim-6) var(--dim-12)',
              background: 'var(--editor-bg)',
              borderBottom: 'var(--dim-1) solid var(--editor-border)',
              fontSize: 'var(--text-12)',
              fontWeight: 'var(--weight-500)',
              color: 'var(--editor-text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-10)' }}>
              <span style={{ fontWeight: 'var(--weight-600)', color: 'var(--editor-text)' }}>
                编辑 Infographic 信息图源码 (YAML / JSON)
              </span>

              {/* 预设模板快速填充下拉 */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="nb-info-tmpl-trigger"
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                >
                  <Sparkles size={12} />
                  <span>载入预设模板</span>
                  <ChevronDown size={11} />
                </button>

                {showTemplateDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'var(--pct-100)',
                      left: 0,
                      marginTop: 'var(--dim-4)',
                      background: 'var(--editor-surface)',
                      border: 'var(--dim-1) solid var(--editor-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 var(--dim-8) var(--dim-20) var(--nb-black-a12)',
                      zIndex: 'var(--z-10000)',
                      width: 'var(--dim-220)',
                      overflow: 'hidden',
                    }}
                  >
                    {INFOGRAPHIC_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        className="nb-info-dropdown-item"
                        onClick={() => {
                          setEditValue(tmpl.code);
                          setShowTemplateDropdown(false);
                        }}
                      >
                        {/* 彩色形象图标容器 */}
                        <div
                          style={{
                            width: 'var(--dim-24)',
                            height: 'var(--dim-24)',
                            borderRadius: 'var(--radius-sm)',
                            background: tmpl.iconBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <InfographicTemplateIcon iconName={tmpl.iconName} color={tmpl.iconColor} size={14} />
                        </div>
                        {/* 纯中文模板名称（无多余英文后缀） */}
                        <span style={{ fontWeight: 'var(--weight-600)', fontSize: 'var(--text-12)' }}>{tmpl.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--dim-6)' }}>
              <button
                type="button"
                className="nb-info-btn-primary"
                onClick={() => {
                  updateAttributes({ code: editValue });
                  setEditing(false);
                }}
              >
                完成
              </button>
              <button
                type="button"
                className="nb-info-btn-secondary"
                onClick={() => setEditing(false)}
              >
                取消
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="输入 Infographic 结构化配置 (YAML 或 JSON)..."
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(false);
              }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                updateAttributes({ code: editValue });
                setEditing(false);
              }
            }}
            style={{
              width: 'var(--pct-100)',
              minHeight: 'var(--dim-180)',
              padding: 'var(--dim-12) var(--dim-14)',
              fontFamily: 'var(--mono-font-family, monospace)',
              fontSize: 'var(--mono-font-size, var(--dim-13))',
              border: 'none',
              background: 'transparent',
              color: 'var(--editor-text)',
              resize: 'vertical',
              outline: 'none',
              lineHeight: 'var(--leading-1-5)',
            }}
          />
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" style={{ display: 'block', margin: 'var(--dim-14) 0' }} selected={selected}>
      <style>{INFOGRAPHIC_STYLES}</style>
      <div
        ref={containerRef}
        className="nb-infographic-container"
        style={{
          position: 'relative',
          minHeight: 'var(--dim-60)',
          border: 'var(--dim-1) solid var(--editor-border)',
          borderRadius: 'var(--radius-md, var(--dim-8))',
          background: 'var(--editor-surface)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        contentEditable={false}
      >
        {/* 顶部操作条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--dim-4) var(--dim-10)',
            borderBottom: 'var(--dim-1) solid var(--editor-border)',
            background: 'var(--editor-bg)',
            fontSize: 'var(--text-11)',
            color: 'var(--editor-text-muted)',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)' }}>
            <span style={{ fontWeight: 'var(--weight-600)', color: 'var(--editor-accent)' }}>
              Infographic 信息图
            </span>
            {data?.type && (
              <span
                style={{
                  fontSize: 'var(--text-10)',
                  padding: 'var(--dim-1) var(--dim-6)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--nb-auto-3b82f6-a10)',
                  color: 'var(--nb-blue-600)',
                }}
              >
                {data.type}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-4)' }}>
            <Tooltip content="编辑信息图源码" side="top" sideOffset={4}>
              <button
                type="button"
                className="nb-info-icon-btn"
                onClick={() => {
                  setEditValue(code);
                  setEditing(true);
                }}
                aria-label="编辑信息图源码"
              >
                <Edit2 size={12} />
                <span>编辑</span>
              </button>
            </Tooltip>
            <ChartExportMenu
              action="copy"
              variant="ghost"
              source={exportSource}
              fileName={exportFileName}
            />
            <ChartExportMenu
              action="download"
              variant="ghost"
              source={exportSource}
              fileName={exportFileName}
            />
            <Tooltip content="全屏放大查看" side="top" sideOffset={4}>
              <button
                type="button"
                className="nb-info-icon-btn"
                onClick={() => setFullscreen(true)}
                aria-label="全屏放大查看"
              >
                <Maximize2 size={12} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* 内容展示区 */}
        <div
          onDoubleClick={() => {
            setEditValue(code);
            setEditing(true);
          }}
          style={{
            padding: 'var(--dim-14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            minHeight: 'var(--dim-80)',
            cursor: 'default',
          }}
        >
          {error && (
            <div style={{ fontSize: 'var(--text-12)', color: 'var(--nb-red-500)', textAlign: 'center', width: 'var(--pct-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--dim-6)', marginBottom: 'var(--dim-8)' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
              <pre
                style={{
                  padding: 'var(--dim-8)',
                  background: 'var(--editor-bg)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'auto',
                  fontSize: 'var(--text-11)',
                  color: 'var(--editor-text-muted)',
                  textAlign: 'left',
                }}
              >
                {code}
              </pre>
            </div>
          )}

          {!error && data && (
            <div ref={setInlineEl} style={{ width: 'var(--pct-100)' }}>
              <InfographicRenderer data={data} />
            </div>
          )}

          {!code && (
            <span style={{ color: 'var(--editor-text-muted)', fontStyle: 'italic', fontSize: 'var(--text-13)' }}>
              空信息图（双击或点击编辑输入结构化内容）
            </span>
          )}
        </div>
      </div>

      {/* 全屏放大模态框：支持拖动平移、Ctrl+滚轮缩放 */}
      {fullscreen && data && (
        <DiagramFullscreenModal
          title="Infographic 信息图预览"
          exportSource={exportSource}
          exportFileName={exportFileName}
          onClose={closeFullscreen}
        >
          <div
            ref={setFullscreenEl}
            style={{
              // 平移缩放容器按内容收缩，这里给定明确宽度，避免百分比宽度失去参照
              width: 'min(var(--dim-900), calc(100vw - var(--dim-80)))',
              background: 'var(--editor-surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--dim-24)',
              boxShadow: '0 var(--dim-20) var(--dim-40) var(--nb-black-a20)',
            }}
          >
            <InfographicRenderer data={data} />
          </div>
        </DiagramFullscreenModal>
      )}
    </NodeViewWrapper>
  );
}

/** Infographic 块节点定义 */
export const InfographicBlock = InfographicBlockCore.extend({
  addNodeView() {
    return ReactNodeViewRenderer(InfographicComponent);
  },
  addCommands() {
    return {
      insertInfographic:
        (code: string) =>
        ({ commands }: { commands: { insertContent: (content: unknown) => boolean } }) => {
          return commands.insertContent({
            type: 'infographicBlock',
            attrs: { code },
          });
        },
    } as never;
  }
});
