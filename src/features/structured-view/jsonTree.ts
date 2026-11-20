// JSON 结构化视图：解析、扁平化行模型与 package.json 语义摘要
// 纯函数，不依赖 React 与编辑器内核。

export type JsonValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonRow {
  /** 稳定路径：`$`、`$.name`、`$.list[0]` */
  path: string;
  depth: number;
  /** 对象键；数组元素为 null（用 index 展示） */
  key: string | null;
  index: number | null;
  kind: JsonValueKind;
  /** 单行展示值，字符串带引号并截断 */
  preview: string;
  expandable: boolean;
  expanded: boolean;
  childCount: number;
}

export interface JsonRowsResult {
  rows: JsonRow[];
  /** 超过行数上限时为 true */
  truncated: boolean;
}

export interface JsonRowsOptions {
  maxRows?: number;
  maxPreview?: number;
}

export interface JsonSearchResult extends JsonRowsResult {
  /** 实际命中的节点数（不含仅作为祖先显示的行） */
  matched: number;
  /** 查询为空时为 false，此时结果与 buildJsonRows 一致 */
  active: boolean;
}

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

const DEFAULT_MAX_ROWS = 2000;
const DEFAULT_MAX_PREVIEW = 80;

export function kindOf(value: unknown): JsonValueKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

/** 解析 JSON；失败时把位置信息压成一句可读提示 */
export function parseJsonDocument(text: string): JsonParseResult {
  if (!text.trim()) return { ok: false, error: '文档为空' };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function childCountOf(value: unknown, kind: JsonValueKind): number {
  if (kind === 'array') return (value as unknown[]).length;
  if (kind === 'object') return Object.keys(value as Record<string, unknown>).length;
  return 0;
}

/** 生成稳定且无歧义的子路径：普通键用点号，特殊键用 JSON 字符串下标 */
export function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

/** 单行预览：字符串截断，容器显示条目数 */
export function describeValue(
  value: unknown,
  kind: JsonValueKind,
  maxPreview = DEFAULT_MAX_PREVIEW,
): string {
  if (kind === 'object') return `{…} ${childCountOf(value, kind)} 项`;
  if (kind === 'array') return `[…] ${childCountOf(value, kind)} 项`;
  if (kind === 'null') return 'null';
  if (kind === 'string') {
    const raw = JSON.stringify(value) ?? '""';
    return raw.length > maxPreview ? `${raw.slice(0, maxPreview)}…` : raw;
  }
  return String(value);
}

/**
 * 把 JSON 展开成可见行。
 * 只有出现在 `expanded` 中的容器才会展开子节点。
 */
export function buildJsonRows(
  value: unknown,
  expanded: ReadonlySet<string>,
  options: JsonRowsOptions = {},
): JsonRowsResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxPreview = options.maxPreview ?? DEFAULT_MAX_PREVIEW;
  const rows: JsonRow[] = [];
  let truncated = false;

  const walk = (node: unknown, path: string, key: string | null, index: number | null, depth: number) => {
    if (rows.length >= maxRows) {
      truncated = true;
      return;
    }
    const kind = kindOf(node);
    const expandable = kind === 'object' || kind === 'array';
    const isExpanded = expandable && expanded.has(path);
    rows.push({
      path,
      depth,
      key,
      index,
      kind,
      preview: describeValue(node, kind, maxPreview),
      expandable,
      expanded: isExpanded,
      childCount: childCountOf(node, kind),
    });
    if (!isExpanded) return;

    if (kind === 'array') {
      (node as unknown[]).forEach((child, childIndex) => {
        walk(child, `${path}[${childIndex}]`, null, childIndex, depth + 1);
      });
    } else if (kind === 'object') {
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        walk(child, childPath(path, childKey), childKey, null, depth + 1);
      }
    }
  };

  walk(value, '$', null, null, 0);
  return { rows, truncated };
}

/** 默认展开根节点与第一层容器，避免一打开就是一行 `{…}` */
export function initialExpandedPaths(value: unknown): Set<string> {
  const expanded = new Set<string>(['$']);
  if (kindOf(value) !== 'object') return expanded;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const kind = kindOf(child);
    if (kind === 'object' || kind === 'array') expanded.add(childPath('$', key));
  }
  return expanded;
}

/**
 * 在执行搜索时收集需要显示的行：命中节点、其祖先，以及命中容器的直接标量子级。
 * 返回的行按树序排列，折叠状态由可见子级决定；空查询回退到默认展开视图。
 */
export function searchJsonRows(
  value: unknown,
  query: string,
  options: JsonRowsOptions = {},
): JsonSearchResult {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    const base = buildJsonRows(value, initialExpandedPaths(value), options);
    return { ...base, matched: 0, active: false };
  }

  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxPreview = options.maxPreview ?? DEFAULT_MAX_PREVIEW;
  const visible = new Set<string>();
  const rows: JsonRow[] = [];
  let matched = 0;
  let truncated = false;

  interface ChildEntry {
    child: unknown;
    path: string;
    name: string | null;
    index: number | null;
  }

  const childrenOf = (node: unknown, kind: JsonValueKind, path: string): ChildEntry[] => {
    if (kind === 'array') {
      return (node as unknown[]).map((child, index) => ({
        child,
        path: `${path}[${index}]`,
        name: null,
        index,
      }));
    }
    if (kind !== 'object') return [];
    return Object.entries(node as Record<string, unknown>).map(([key, child]) => ({
      child,
      path: childPath(path, key),
      name: key,
      index: null,
    }));
  };

  const collect = (node: unknown, path: string, key: string | null, ancestors: string[]): void => {
    const kind = kindOf(node);
    const expandable = kind === 'object' || kind === 'array';
    const hit =
      (key !== null && key.toLowerCase().includes(needle)) ||
      describeValue(node, kind, maxPreview).toLowerCase().includes(needle);
    if (hit) {
      matched += 1;
      visible.add(path);
      ancestors.forEach((ancestor) => visible.add(ancestor));
      // 容器命中时展开一层：让用户直接看到字段值，而不是只看到 `{…} N 项`
      if (expandable) {
        for (const entry of childrenOf(node, kind, path)) {
          const childKind = kindOf(entry.child);
          if (childKind !== 'object' && childKind !== 'array') visible.add(entry.path);
        }
      }
    }
    for (const entry of childrenOf(node, kind, path)) {
      collect(entry.child, entry.path, entry.name, [...ancestors, path]);
    }
  };
  collect(value, '$', null, []);

  const emit = (node: unknown, path: string, key: string | null, index: number | null, depth: number): void => {
    if (!visible.has(path)) return;
    if (rows.length >= maxRows) {
      truncated = true;
      return;
    }
    const kind = kindOf(node);
    const expandable = kind === 'object' || kind === 'array';
    const children = childrenOf(node, kind, path);
    const hasVisibleChild = children.some((entry) => visible.has(entry.path));
    rows.push({
      path,
      depth,
      key,
      index,
      kind,
      preview: describeValue(node, kind, maxPreview),
      expandable,
      expanded: hasVisibleChild,
      childCount: childCountOf(node, kind),
    });
    if (!hasVisibleChild) return;
    for (const entry of children) {
      emit(entry.child, entry.path, entry.name, entry.index, depth + 1);
    }
  };
  emit(value, '$', null, null, 0);

  return { rows, truncated, matched, active: true };
}

export interface PackageDependencyGroup {
  field: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  label: string;
  count: number;
}

export interface PackageSummary {
  name: string;
  version: string;
  description: string;
  dependencyGroups: PackageDependencyGroup[];
  scriptCount: number;
}

const DEPENDENCY_FIELDS: Array<{ field: PackageDependencyGroup['field']; label: string }> = [
  { field: 'dependencies', label: '运行依赖' },
  { field: 'devDependencies', label: '开发依赖' },
  { field: 'peerDependencies', label: '对等依赖' },
  { field: 'optionalDependencies', label: '可选依赖' },
];

/**
 * 识别 package.json 并给出语义摘要。
 * 只认「有 name 且至少包含依赖组或 scripts」的对象，普通 JSON 返回 null。
 */
export function summarizePackageJson(value: unknown): PackageSummary | null {
  if (kindOf(value) !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== 'string') return null;

  const groups: PackageDependencyGroup[] = [];
  for (const { field, label } of DEPENDENCY_FIELDS) {
    const group = record[field];
    if (kindOf(group) === 'object') {
      groups.push({ field, label, count: Object.keys(group as Record<string, unknown>).length });
    }
  }
  const scripts = record.scripts;
  const scriptCount = kindOf(scripts) === 'object' ? Object.keys(scripts as Record<string, unknown>).length : 0;
  if (groups.length === 0 && scriptCount === 0) return null;

  return {
    name: record.name,
    version: typeof record.version === 'string' ? record.version : '',
    description: typeof record.description === 'string' ? record.description : '',
    dependencyGroups: groups,
    scriptCount,
  };
}
