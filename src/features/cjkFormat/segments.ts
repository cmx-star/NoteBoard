// 把 Markdown 文本切成「可格式化正文」与「受保护区域」
//
// 🔴 受保护区域一旦被规则改写就会破坏文档结构（代码、链接、公式、实体）。
//    这里只负责切分，具体规则在 rules.ts；两者都不依赖编辑器内核。

export interface CjkSegment {
  kind: 'text' | 'protected';
  text: string;
}

/** 围栏代码块起始：最多 3 个空格缩进 + 3 个以上反引号或波浪线 */
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})[^\n]*$/;

/** 行内需要整体保护的结构；顺序即优先级 */
const INLINE_PROTECTED_RE = new RegExp(
  [
    '(`+)[\\s\\S]*?\\1', // 行内代码（反引号数量必须配对）
    '!?\\[\\[[^\\]\\n]*\\]\\]', // 双向链接 / 嵌入
    '\\]\\([^)\\n]*\\)', // 链接与图片目标
    '^\\[[^\\]\\n]+\\]:[^\\n]*', // 引用式链接定义
    '&(?:#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});', // HTML 实体
    '<\\/?[A-Za-z][^>\\n]*>', // HTML 标签
    '<https?:\\/\\/[^>\\n]+>', // 自动链接
    '(?:https?|ftp|file):\\/\\/[^\\s<>"\'）】，。；：！？、]+', // 裸 URL
    '\\$\\$[\\s\\S]*?\\$\\$', // 块级公式
    '\\$[^$\\n]+\\$', // 行内公式
  ].join('|'),
  'gm',
);

/** 拆分行内受保护结构，未命中的部分原样作为 text 段 */
function splitInline(line: string): CjkSegment[] {
  const segments: CjkSegment[] = [];
  let cursor = 0;
  INLINE_PROTECTED_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_PROTECTED_RE.exec(line)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: line.slice(cursor, match.index) });
    }
    segments.push({ kind: 'protected', text: match[0] });
    cursor = match.index + match[0].length;
    if (match[0].length === 0) INLINE_PROTECTED_RE.lastIndex += 1;
  }
  if (cursor < line.length) {
    segments.push({ kind: 'text', text: line.slice(cursor) });
  }
  return segments;
}

/** 是否是该围栏代码块的结束行 */
function fenceCloser(line: string, marker: string): boolean {
  const char = marker[0];
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith(char.repeat(3))) return false;
  const run = trimmed.match(char === '`' ? /^`+/ : /^~+/)?.[0] ?? '';
  return run.length >= marker.length && /^[`~]+$/.test(trimmed);
}

/** YAML frontmatter 只在文件最开头成立；返回结束行下标 */
function frontmatterEnd(lines: string[]): number {
  if (lines.length === 0) return -1;
  if (lines[0].trim() !== '---') return -1;
  for (let i = 1; i < Math.min(lines.length, 400); i++) {
    const line = lines[i].trim();
    if (line === '---' || line === '...') return i;
  }
  return -1;
}

/**
 * 把整篇文本切分为受保护段与正文段。
 * 行结构（换行符）原样保留在段落文本里，重建时直接拼接。
 */
export function splitProtectedSegments(input: string): CjkSegment[] {
  const lines = input.match(/[^\n]*\n|[^\n]+/g) ?? [];
  if (lines.length === 0) return [];

  const segments: CjkSegment[] = [];
  let textBuffer = '';
  let protectedBuffer = '';
  let fenceMarker: string | null = null;

  const flushText = () => {
    if (!textBuffer) return;
    segments.push(...splitInline(textBuffer));
    textBuffer = '';
  };
  const flushProtected = () => {
    if (!protectedBuffer) return;
    segments.push({ kind: 'protected', text: protectedBuffer });
    protectedBuffer = '';
  };

  const fmEnd = frontmatterEnd(lines);
  let index = 0;
  if (fmEnd >= 0) {
    protectedBuffer = lines.slice(0, fmEnd + 1).join('');
    flushProtected();
    index = fmEnd + 1;
  }

  for (; index < lines.length; index++) {
    const line = lines[index];
    if (fenceMarker) {
      protectedBuffer += line;
      if (fenceCloser(line, fenceMarker)) {
        flushProtected();
        fenceMarker = null;
      }
      continue;
    }

    // JS 的 `$` 不匹配末尾换行，先剥掉行尾再判断围栏
    const fence = line.replace(/\r?\n$/, '').match(FENCE_OPEN_RE);
    if (fence) {
      flushText();
      fenceMarker = fence[1];
      protectedBuffer += line;
      continue;
    }

    textBuffer += line;
  }

  flushText();
  flushProtected();
  return segments;
}
