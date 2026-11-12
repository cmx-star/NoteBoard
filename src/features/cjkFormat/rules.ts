// 单行正文的中文排版规则
//
// 规则顺序有意固定：省略号 → 标点 → 括号 → 间距。
// 行首的缩进、引用符、标题井号、列表标记先剥离，避免把 `1.` 当成句号。

import { containsCjk, isCjkChar, isLatinishChar } from './cjk';
import type { CjkFormatOptions } from './types';

/** 行首结构：缩进 + 引用符 + 标题 / 列表标记；这些字符不参与规则 */
const LINE_PREFIX_RE =
  /^([ \t]*(?:>[ \t]?)*)(#{1,6}[ \t]+|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)?/;

const ASCII_PUNCT_TO_FULLWIDTH: Record<string, string> = {
  ',': '，',
  ';': '；',
  ':': '：',
  '!': '！',
  '?': '？',
};

/** 两个字符之间是否需要补中文排版空格 */
export function needsCjkSpace(left: string, right: string): boolean {
  return (
    (isCjkChar(left) && isLatinishChar(right)) ||
    (isLatinishChar(left) && isCjkChar(right))
  );
}

/** 中文与西文 / 数字之间补一个空格（已有空白时不重复补） */
export function applyCjkSpacing(text: string): string {
  let out = '';
  let prev: string | null = null;
  for (const char of text) {
    if (prev !== null && needsCjkSpace(prev, char)) out += ' ';
    out += char;
    prev = char;
  }
  return out;
}

/** 紧邻中文的半角标点转全角；数字上下文（3.14 / 12:30）保持原样 */
export function normalizeCjkPunctuation(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const prev = chars[i - 1];
    const next = chars[i + 1];

    if (char === '.') {
      const prevCjk = prev !== undefined && isCjkChar(prev);
      const nextBlocks = next !== undefined && isLatinishChar(next);
      if (prevCjk && !nextBlocks) {
        out += '。';
        continue;
      }
    }

    const fullwidth = ASCII_PUNCT_TO_FULLWIDTH[char];
    const adjacentCjk =
      (prev !== undefined && isCjkChar(prev)) || (next !== undefined && isCjkChar(next));
    if (fullwidth && adjacentCjk) {
      out += fullwidth;
      continue;
    }

    out += char;
  }
  return out;
}

/** 只转换「括号内有中文」的圆括号，方括号涉及 Markdown 链接，保持原样 */
export function normalizeCjkBrackets(text: string): string {
  const chars = Array.from(text);
  const stack: number[] = [];
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '(') {
      stack.push(i);
    } else if (chars[i] === ')' && stack.length > 0) {
      pairs.push([stack.pop() as number, i]);
    }
  }
  for (const [open, close] of pairs) {
    if (containsCjk(chars.slice(open + 1, close).join(''))) {
      chars[open] = '（';
      chars[close] = '）';
    }
  }
  return chars.join('');
}

/** 三个半角点转中文省略号；更长的点串与西文相邻的省略号保持原样 */
export function normalizeCjkEllipsis(text: string): string {
  return text.replace(/\.{2,}/g, (match, offset: number) => {
    if (match.length !== 3) return match;
    const before = text[offset - 1];
    const after = text[offset + 3];
    if (before && isLatinishChar(before)) return match;
    if (after && isLatinishChar(after)) return match;
    return '……';
  });
}

/** 对一行正文应用指定规则，保留行首结构与行尾换行 */
export function formatCjkLine(line: string, options: CjkFormatOptions): string {
  const stripped = line.replace(/\r?\n$/, '');
  const newline = line.slice(stripped.length);
  if (!stripped.trim()) return line;

  const prefix = stripped.match(LINE_PREFIX_RE)?.[0] ?? '';
  const body = stripped.slice(prefix.length);
  if (!body) return line;

  let next = body;
  if (options.ellipsis) next = normalizeCjkEllipsis(next);
  if (options.punctuation) next = normalizeCjkPunctuation(next);
  if (options.brackets) next = normalizeCjkBrackets(next);
  if (options.spacing) next = applyCjkSpacing(next);
  return prefix + next + newline;
}

/** 对一段正文（可含多行）应用规则 */
export function formatCjkText(text: string, options: CjkFormatOptions): string {
  return text.replace(/[^\n]*\n|[^\n]+/g, (line) => formatCjkLine(line, options));
}
