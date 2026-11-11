// NoteBoard PlantUML / UML TipTap 扩展
// 自研 plantumlBlock 节点 + 视口门控 + LRU 缓存 + 全屏放大模态框与图片导出
// 详见 docs/09-开发路线图.md

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Maximize2, Edit2, AlertCircle } from 'lucide-react';
import { renderPlantUmlToSvg } from './plantumlEncoder';
import { observe } from '../editor-md/viewportActivation';
import { scheduleTask, cancelTask } from '../editor-md/viewportWorkScheduler';
import { useEditorActive } from '../../core/editor/EditorActivityContext';
import { ChartExportMenu } from '../export/ChartExportMenu';
import { DiagramFullscreenModal } from '../editor-md/DiagramFullscreenModal';
import { buildExportFileName, type ChartImageSource } from '../export/chartExport';
import { Tooltip } from '../../components/Tooltip';
import { PlantUmlBlockCore } from './plantumlCore';

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

function PlantUmlComponent({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const active = useEditorActive();
  // 重新激活未变化的图形使用已有结果，不再次请求图表服务。
  const renderedCodeRef = useRef<string | null>(null);
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
  const renderTokenRef = useRef<number>(0);

  const code = node.attrs.code || '';

  const doRender = useCallback(async (currentCode: string) => {
    if (!currentCode.trim()) {
      setSvg(null);
      setError(null);
      return;
    }

    if (renderedCodeRef.current === currentCode) return;
    const token = ++renderTokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await renderPlantUmlToSvg(currentCode);
      if (token !== renderTokenRef.current) return;

      if (result.error && !result.svg) {
        setError(result.error);
        setSvg(null);
      } else {
        setSvg(result.svg);
        if (!result.error) renderedCodeRef.current = currentCode;
        if (result.error) {
          setError(result.error);
        }
      }
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

    const unobserve = observe(
      el,
      () => {
        setInViewport(true);
      },
      { once: true },
    );

    return unobserve;
  }, []);

  // 视口可见且有代码时调度渲染
  useEffect(() => {
    if (!active || !inViewport || !code) return;
    const identity = `plantuml:${editorTaskId(editor)}:${getPos()}`;
    scheduleTask(identity, () => doRender(code));
    // 后台只取消非必要的预览任务，继续保留内核与正文。
    return () => cancelTask(identity);
  }, [active, inViewport, code, doRender, editor, getPos]);

  // 导出来源：渲染出 SVG 后复制/导出才可用
  const exportSource: ChartImageSource | null = svg ? { kind: 'svg', svg } : null;
  const exportFileName = buildExportFileName('', 'plantuml');

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
            <span>编辑 PlantUML / UML 图表</span>
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
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="输入 PlantUML 语法，例如:&#10;@startuml&#10;Alice -> Bob: Hello&#10;@enduml"
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
            <span style={{ fontWeight: 'var(--weight-600)', color: 'var(--editor-accent)' }}>PlantUML</span>
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
              <span>📐 PlantUML 图表（滚动到视口时渲染）</span>
            </div>
          )}

          {inViewport && loading && !svg && (
            <div style={{ color: 'var(--editor-text-muted)', fontSize: 'var(--text-13)' }}>
              <span>正在获取 PlantUML 矢量图</span>
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
              空 PlantUML 图表（双击或点击编辑输入内容）
            </span>
          )}
        </div>
      </div>

      {/* 全屏模态弹窗：支持拖动平移、Ctrl+滚轮缩放 */}
      {fullscreen && svg && (
        <DiagramFullscreenModal
          title="PlantUML 图表预览"
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

/** PlantUML 块级节点 */
export const PlantUmlBlock = PlantUmlBlockCore.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PlantUmlComponent);
  },
  addCommands() {
    return {
      insertPlantUml:
        (code: string) =>
        ({ commands }: { commands: { insertContent: (content: unknown) => boolean } }) => {
          return commands.insertContent({
            type: 'plantumlBlock',
            attrs: { code },
          });
        },
    } as never;
  }
});
