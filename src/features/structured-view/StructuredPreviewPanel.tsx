// 结构化视图面板：只读 JSON 树 + package.json 语义摘要
//
// 只读，不写回文档；内容来自 documentStore 的实时镜像，
// 因此源码编辑器每次输入都会同步刷新。

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, X } from 'lucide-react';
import './structuredView.css';
import { useDocumentStore } from '../../stores/documentStore';
import { showToast } from '../../stores/toastStore';
import { useWindowStore } from '../../stores/windowStore';
import { useViewStore, supportsStructuredView } from '../../stores/viewStore';
import {
  buildJsonRows,
  initialExpandedPaths,
  parseJsonDocument,
  searchJsonRows,
  summarizePackageJson,
  type JsonRow,
  type JsonValueKind,
} from './jsonTree';

const WIDTH_STORAGE_KEY = 'nb:structured-view:width';
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH_RATIO = 0.7;

const PREVIEW_CLASS: Record<JsonValueKind, string> = {
  object: '',
  array: '',
  string: 'is-string',
  number: 'is-number',
  boolean: 'is-boolean',
  null: 'is-null',
};

function JsonTree({ value, query }: { value: unknown; query: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpandedPaths(value));
  const searching = query.trim().length > 0;
  const result = useMemo(
    () => (searching ? searchJsonRows(value, query) : { ...buildJsonRows(value, expanded), matched: 0, active: false }),
    [value, expanded, query, searching],
  );
  const { rows, truncated } = result;

  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div role="tree" aria-label="JSON 结构">
      {searching && (
        <div className="nb-structured-hint">
          {result.matched > 0 ? `找到 ${result.matched} 个匹配项` : '没有匹配项'}
        </div>
      )}
      {rows.map((row) => (
        <JsonTreeRow
          key={row.path}
          row={row}
          onToggle={!searching && row.expandable ? () => toggle(row.path) : undefined}
          onCopy={copyPath}
        />
      ))}
      {truncated && (
        <div className="nb-structured-hint">
          内容超过 2000 行，已截断显示。可折叠上层节点查看其余部分。
        </div>
      )}
    </div>
  );
}

async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    showToast('已复制路径', 'info');
  } catch {
    showToast('复制失败', 'warning');
  }
}

function JsonTreeRow({ row, onToggle, onCopy }: { row: JsonRow; onToggle?: () => void; onCopy: (path: string) => void }) {
  const label = row.key ?? (row.index === null ? '' : `[${row.index}]`);
  const style = { paddingLeft: `calc(var(--dim-12) + ${row.depth} * var(--dim-14, 14px))` };

  const content = (
    <>
      <span className="nb-structured-caret" aria-hidden="true">
        {row.expandable ? (
          row.expanded ? (
            <ChevronDown size={11} />
          ) : (
            <ChevronRight size={11} />
          )
        ) : null}
      </span>
      {row.key !== null && <span className="nb-structured-key">{row.key}:</span>}
      {row.index !== null && <span className="nb-structured-index">[{row.index}]</span>}
      <span className={`nb-structured-preview ${PREVIEW_CLASS[row.kind]}`}>{row.preview}</span>
    </>
  );

  return (
    <div
      className="nb-structured-row"
      style={style}
      role="treeitem"
      aria-expanded={onToggle ? row.expanded : undefined}
      aria-label={label}
    >
      {onToggle ? (
        <button type="button" className="nb-structured-row-main" onClick={onToggle}>
          {content}
        </button>
      ) : (
        <div className="nb-structured-row-main">{content}</div>
      )}
      <button
        type="button"
        className="nb-structured-copy"
        title={`复制路径：${row.path}`}
        aria-label={`复制路径 ${row.path}`}
        onClick={() => onCopy(row.path)}
      >
        <Copy size={11} />
      </button>
    </div>
  );
}

export function StructuredPreviewPanel() {
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
      return Number.isFinite(stored) && stored >= MIN_PANEL_WIDTH ? stored : 0;
    } catch {
      return 0;
    }
  });
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const open = useViewStore((s) => s.structuredViewOpen);
  const boundDocKey = useViewStore((s) => s.structuredViewDocKey);
  const close = useViewStore((s) => s.closeStructuredView);
  const activeKey = useWindowStore((s) => s.activeKey);
  const tab = useWindowStore((s) => s.tabs.find((item) => item.key === s.activeKey));
  const content = useDocumentStore((s) =>
    activeKey ? s.documents.get(activeKey)?.content ?? '' : '',
  );

  useEffect(() => {
    if (!width) return;
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)));
    } catch {
      // 隐私模式下 localStorage 不可写，宽度仅对当前会话生效
    }
  }, [width]);

  if (!open || !activeKey || boundDocKey !== activeKey || !supportsStructuredView(tab)) return null;

  const parsed = parseJsonDocument(content);
  const summary = parsed.ok ? summarizePackageJson(parsed.value) : null;

  const resize = {
    start(event: React.PointerEvent<HTMLDivElement>) {
      const panel = event.currentTarget.parentElement;
      if (!panel) return;
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: panel.getBoundingClientRect().width };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    move(event: React.PointerEvent<HTMLDivElement>) {
      const drag = dragRef.current;
      if (!drag) return;
      const max = Math.max(MIN_PANEL_WIDTH, window.innerWidth * MAX_PANEL_WIDTH_RATIO);
      setWidth(Math.min(Math.max(drag.startWidth + drag.startX - event.clientX, MIN_PANEL_WIDTH), max));
    },
    end(event: React.PointerEvent<HTMLDivElement>) {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    key(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const panelWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
      const base = width || panelWidth || 420;
      const next = event.key === 'ArrowLeft' ? base + 24 : base - 24;
      const max = Math.max(MIN_PANEL_WIDTH, window.innerWidth * MAX_PANEL_WIDTH_RATIO);
      setWidth(Math.min(Math.max(next, MIN_PANEL_WIDTH), max));
    },
    reset() {
      setWidth(0);
      try {
        window.localStorage.removeItem(WIDTH_STORAGE_KEY);
      } catch {
        // 同上，忽略不可写的存储
      }
    },
  };

  return (
    <aside
      className="nb-structured-panel"
      aria-label="结构化视图"
      style={width ? { width: `${width}px` } : undefined}
    >
      <div
        className="nb-structured-resizer"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="调整结构化视图宽度"
        title="拖动调整宽度，双击恢复默认"
        onPointerDown={resize.start}
        onPointerMove={resize.move}
        onPointerUp={resize.end}
        onPointerCancel={resize.end}
        onKeyDown={resize.key}
        onDoubleClick={resize.reset}
      />
      <div className="nb-structured-header">
        <span className="nb-structured-title" title={tab?.displayName}>
          {tab?.displayName ?? 'JSON'}
        </span>
        <span className="nb-structured-badge">只读</span>
        <button type="button" className="nb-structured-close" title="关闭结构化视图" onClick={close}>
          <X size={14} />
        </button>
      </div>
      <div className="nb-structured-body">
        {!parsed.ok ? (
          <div className="nb-structured-hint nb-structured-error">
            <div>JSON 解析失败，已回退到源码视图。</div>
            <div>{parsed.error}</div>
          </div>
        ) : (
          <>
            <div className="nb-structured-search">
              <input
                type="search"
                value={query}
                placeholder="搜索键或值"
                aria-label="搜索 JSON 结构"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" title="清空搜索" onClick={() => setQuery('')}>
                  <X size={12} />
                </button>
              )}
            </div>
            {summary && (
              <div className="nb-structured-summary">
                <div className="nb-structured-summary-name">
                  {summary.name}
                  {summary.version ? ` · ${summary.version}` : ''}
                </div>
                {summary.description && (
                  <div className="nb-structured-summary-meta">{summary.description}</div>
                )}
                <div className="nb-structured-summary-deps">
                  {summary.dependencyGroups.map((group) => `${group.label} ${group.count}`).join(' · ')}
                  {summary.dependencyGroups.length > 0 && summary.scriptCount > 0 ? ' · ' : ''}
                  {summary.scriptCount > 0 ? `脚本 ${summary.scriptCount}` : ''}
                </div>
              </div>
            )}
            <JsonTree
              key={`${activeKey}:${summary ? 'package' : 'json'}`}
              value={parsed.value}
              query={query}
            />
          </>
        )}
      </div>
    </aside>
  );
}
