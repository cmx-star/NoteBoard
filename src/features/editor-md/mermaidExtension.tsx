// NoteBoard Mermaid 图表扩展
// 自研节点 + 懒加载 + securityLevel: strict + 全局串行渲染队列 + 陈旧守卫 + 视口门控
// 详见 docs/09-开发路线图.md 8.5
//
// 设计：
// 1. 自研 mermaidBlock 节点
// 2. import('mermaid') 懒加载
// 3. securityLevel: 'strict', startOnLoad: false
// 4. 全局串行渲染队列（避免并发污染）
// 5. 陈旧守卫：渲染完成后检查内容是否已变
// 6. Skeleton 占位
// 7. 主题切换时重渲染

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { observe } from './viewportActivation';
import { scheduleTask, cancelTask } from './viewportWorkScheduler';
import { useEditorActive } from '../../core/editor/EditorActivityContext';
import { Tooltip } from '../../components/Tooltip';
import { Maximize2, Edit2, AlertCircle } from 'lucide-react';
import { ChartExportMenu } from '../export/ChartExportMenu';
import { DiagramFullscreenModal } from './DiagramFullscreenModal';
import { buildExportFileName, type ChartImageSource } from '../export/chartExport';
import { MermaidBlockCore } from './mermaidCore';

/** 🔴 S14：任务身份 = editor 实例（文档）+ 节点位置——不同节点互不覆盖 */
const editorTaskIds = new WeakMap<object, number>();
let nextEditorTaskId = 0;
function editorTaskId(editor: object): number {
  let id = editorTaskIds.get(editor);
  if (id === undefined) {
    id = (nextEditorTaskId += 1);
    editorTaskIds.set(editor, id);
  }
  return id;
}

// ── 全局串行渲染队列 ──

type RenderTask = {
  id: number;
  code: string;
  theme: 'default' | 'dark' | 'forest';
  resolve: (svg: string) => void;
  reject: (error: Error) => void;
};

const renderQueue: RenderTask[] = [];
let isProcessing = false;
let nextId = 0;

/** Mermaid 模块延迟加载 */
let mermaidModule: typeof import('mermaid') | null = null;
let mermaidLoading: Promise<typeof import('mermaid')> | null = null;

async function loadMermaid(): Promise<typeof import('mermaid')> {
  if (mermaidModule) return mermaidModule;
  if (mermaidLoading) return mermaidLoading;

  mermaidLoading = import('mermaid').then((mod) => {
    mermaidModule = mod;
    // 初始化
    mod.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
    });
    return mod;
  });
  return mermaidLoading;
}

/** 处理队列中的下一个任务 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  const task = renderQueue.shift();
  if (!task) return;

  isProcessing = true;

  try {
    const mermaid = await loadMermaid();

    // 设置主题
    if (task.theme === 'dark') {
      mermaid.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
    } else if (task.theme === 'forest') {
      mermaid.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'forest' });
    } else {
      mermaid.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    }

    // 渲染
    const renderId = `mermaid-${task.id}`;
    const { svg } = await mermaid.default.render(renderId, task.code);
    task.resolve(svg);
  } catch (e) {
    task.reject(e instanceof Error ? e : new Error(String(e)));
  } finally {
    isProcessing = false;
    // 继续处理下一个
    if (renderQueue.length > 0) {
      processQueue();
    }
  }
}

/**
 * 提交 Mermaid 渲染任务到串行队列
 */
function enqueueRender(code: string, theme: 'default' | 'dark' | 'forest'): Promise<string> {
  return new Promise((resolve, reject) => {
    const task: RenderTask = {
      id: nextId++,
      code,
      theme,
      resolve,
      reject,
    };
    renderQueue.push(task);
    processQueue();
  });
}

// ── 获取当前主题 ──

function getCurrentMermaidTheme(): 'default' | 'dark' | 'forest' {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? 'dark' : 'default';
}

// ── React NodeView ──

function MermaidComponent({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const active = useEditorActive();
  // 保留已渲染图形；重新激活且正文/主题未变时不重复运行 Mermaid。
  const renderedSignatureRef = useRef<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [inViewport, setInViewport] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // 关闭回调保持稳定引用，避免弹窗内 Esc 监听反复重绑
  const closeFullscreen = useCallback(() => setFullscreen(false), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renderTokenRef = useRef<number>(0);

  // 进入编辑时聚焦源码框：否则焦点仍在编辑器且整块处于节点选中，首次按键会把整个图表替换掉
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const code = node.attrs.code || '';

  const doRender = useCallback(async (currentCode: string) => {
    if (!currentCode.trim()) {
      setSvg(null);
      setError(null);
      return;
    }

    const theme = getCurrentMermaidTheme();
    const signature = `${theme}:${currentCode}`;
    if (renderedSignatureRef.current === signature) return;
    const token = ++renderTokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await enqueueRender(currentCode, theme);
      // 陈旧守卫：检查内容是否已变
      if (token !== renderTokenRef.current) return;
      setSvg(result);
      renderedSignatureRef.current = signature;
    } catch (e) {
      if (token !== renderTokenRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === renderTokenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 视口门控
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const unobserve = observe(el, () => {
      setInViewport(true);
    }, { once: true });

    return unobserve;
  }, []);

  // 只在视口内时渲染
  useEffect(() => {
    if (!active || !inViewport || !code) return;
    const identity = `mermaid:${editorTaskId(editor)}:${getPos()}`;
    scheduleTask(identity, () => doRender(code));
    // 切走时取消尚未执行的展示任务；正文/保存链不受影响。
    return () => cancelTask(identity);
  }, [active, inViewport, code, doRender, editor, getPos]);

  // 主题切换时重渲染
  useEffect(() => {
    if (!active || !inViewport || !code) return;
    const identity = `mermaid:${editorTaskId(editor)}:${getPos()}`;
    const observer = new MutationObserver(() => {
      scheduleTask(identity, () => doRender(code));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { observer.disconnect(); cancelTask(identity); };
  }, [active, inViewport, code, doRender, editor, getPos]);

  // 导出来源：渲染出 SVG 后复制/导出才可用
  const exportSource: ChartImageSource | null = svg ? { kind: 'svg', svg } : null;
  const exportFileName = buildExportFileName('', 'mermaid');

  if (editing) {
    return (
      <NodeViewWrapper as="div" style={{ display: 'block', margin: 'var(--dim-12) 0' }}>
        <div
          style={{
            border: 'var(--dim-1) solid var(--editor-accent)',
            borderRadius: 'var(--radius-md, var(--dim-8))',
            background: 'var(--editor-surface)',
            overflow: 'hidden',
            boxShadow: '0 var(--dim-4) var(--dim-12) var(--nb-black-a08)',
          }}
        >
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
            <span>编辑 Mermaid 图表源码</span>
            <div style={{ display: 'flex', gap: 'var(--dim-6)' }}>
              <button
                type="button"
                onClick={() => {
                  updateAttributes({ code: editValue });
                  setEditing(false);
                }}
                style={{
                  padding: 'var(--dim-3) var(--dim-10)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--editor-accent)',
                  color: 'var(--nb-white)',
                  border: 'none',
                  fontSize: 'var(--text-12)',
                  cursor: 'pointer',
                  fontWeight: 'var(--weight-500)',
                }}
              >
                完成
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{
                  padding: 'var(--dim-3) var(--dim-8)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--editor-text-muted)',
                  border: 'var(--dim-1) solid var(--control-border)',
                  fontSize: 'var(--text-12)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="输入 Mermaid 语法，例如:&#10;graph TD&#10;    A[开始] --> B[结束]"
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
              minHeight: 'var(--dim-140)',
              padding: 'var(--dim-10) var(--dim-14)',
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
    <NodeViewWrapper as="div" style={{ display: 'block', margin: 'var(--dim-12) 0' }} selected={selected}>
      <div
        ref={containerRef}
        className="nb-diagram-container"
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
        {/* 顶部轻量浮动操作栏 */}
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
            <span style={{ fontWeight: 'var(--weight-600)', color: 'var(--editor-accent)' }}>Mermaid</span>
            {loading && <span>渲染中</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-4)' }}>
            {/* 编辑图表源码 */}
            <Tooltip content="编辑图表源码" side="top" sideOffset={4}>
              <button
                type="button"
                className="nb-diagram-action-btn"
                onClick={() => {
                  setEditValue(code);
                  setEditing(true);
                }}
                aria-label="编辑图表源码"
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
            {svg && (
              <Tooltip content="全屏放大查看" side="top" sideOffset={4}>
                <button
                  type="button"
                  className="nb-diagram-action-btn"
                  onClick={() => setFullscreen(true)}
                  aria-label="全屏放大查看"
                >
                  <Maximize2 size={12} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* 内容展示区 */}
        <div
          onDoubleClick={() => {
            setEditValue(code);
            setEditing(true);
          }}
          style={{
            padding: 'var(--dim-16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            cursor: 'pointer',
            minHeight: 'var(--dim-80)',
          }}
        >
          {!inViewport && code && (
            <div style={{ color: 'var(--editor-text-muted)', fontSize: 'var(--text-13)' }}>
              <span>📊 Mermaid 图表（滚动到视口时渲染）</span>
            </div>
          )}

          {inViewport && loading && !svg && (
            <div style={{ color: 'var(--editor-text-muted)', fontSize: 'var(--text-13)' }}>
              <span>渲染中</span>
            </div>
          )}

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

          {svg && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: 'var(--pct-100)',
                overflowX: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}

          {!code && (
            <span style={{ color: 'var(--editor-text-muted)', fontStyle: 'italic', fontSize: 'var(--text-13)' }}>
              空 Mermaid 图表（双击或点击编辑输入内容）
            </span>
          )}
        </div>
      </div>

      {/* 全屏模态弹窗：支持拖动平移、Ctrl+滚轮缩放 */}
      {fullscreen && svg && (
        <DiagramFullscreenModal
          title="Mermaid 图表预览"
          exportSource={exportSource}
          exportFileName={exportFileName}
          onClose={closeFullscreen}
        >
          <div
            style={{
              background: 'var(--editor-surface)',
              padding: 'var(--dim-24)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 var(--dim-20) var(--dim-40) var(--nb-black-a20)',
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </DiagramFullscreenModal>
      )}
    </NodeViewWrapper>
  );
}

// ── TipTap 节点定义 ──

/** Mermaid 块节点 */
export const MermaidBlock = MermaidBlockCore.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent);
  },
  addCommands() {
    return {
      insertMermaid:
        (code: string) =>
        ({ commands }: { commands: { insertContent: (content: unknown) => boolean } }) => {
          return commands.insertContent({
            type: 'mermaidBlock',
            attrs: { code },
          });
        },
    } as never;
  }
});

/** 清除 Mermaid 模块（主题切换时重置初始化） */
export function resetMermaid(): void {
  mermaidModule = null;
  mermaidLoading = null;
  renderQueue.length = 0;
  isProcessing = false;
}
