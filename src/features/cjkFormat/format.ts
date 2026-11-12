// 中文排版格式化入口
//
// 管线：受保护区域切分 → 逐行规则 → 骨架校验。

import type { CjkFormatOptions, CjkFormatResult } from './types';
import { DEFAULT_CJK_FORMAT_OPTIONS } from './types';
import { splitProtectedSegments } from './segments';
import { formatCjkText, needsCjkSpace } from './rules';
import { isStructurePreserved } from './integrity';

/** 单次处理上限：超过后直接拒绝，避免同步规则阻塞输入 */
export const CJK_FORMAT_MAX_LENGTH = 2_000_000;

/** 受保护段边界参与间距判断：反引号视作西文起点（行内代码） */
function boundaryChar(char: string | undefined): string {
  return char === '`' ? 'a' : (char ?? '');
}

/** 取字符串首码点，避免把代理对拆成两半 */
function firstCodePoint(text: string): string {
  const cp = text.codePointAt(0);
  return cp === undefined ? '' : String.fromCodePoint(cp);
}

/** 取字符串末码点，代理对整体返回 */
function lastCodePoint(text: string): string {
  const length = text.length;
  if (length === 0) return '';
  const cp = text.codePointAt(length - 1);
  if (cp === undefined) return '';
  if (cp >= 0xdc00 && cp <= 0xdfff && length >= 2) {
    const pair = text.codePointAt(length - 2);
    if (pair !== undefined) return String.fromCodePoint(pair);
  }
  return String.fromCodePoint(cp);
}

/**
 * 格式化一段 Markdown / 纯文本。
 * 受保护区域（代码块、行内代码、链接、公式、实体、frontmatter）原样保留。
 */
export function formatCjkMarkdown(
  input: string,
  options: Partial<CjkFormatOptions> = {},
): CjkFormatResult {
  if (!input) return { text: input, changed: false };
  if (input.length > CJK_FORMAT_MAX_LENGTH) {
    return { text: input, changed: false, rejected: 'too-large' };
  }

  const resolved: CjkFormatOptions = { ...DEFAULT_CJK_FORMAT_OPTIONS, ...options };
  if (!resolved.spacing && !resolved.punctuation && !resolved.brackets && !resolved.ellipsis) {
    return { text: input, changed: false };
  }

  let output = '';
  let lastChar: string | undefined;
  for (const segment of splitProtectedSegments(input)) {
    const text =
      segment.kind === 'protected' ? segment.text : formatCjkText(segment.text, resolved);
    if (text) {
      const firstChar = firstCodePoint(text);
      if (resolved.spacing && lastChar && needsCjkSpace(lastChar, boundaryChar(firstChar))) {
        output += ' ';
      }
      output += text;
      lastChar = boundaryChar(lastCodePoint(text));
    }
  }

  if (output === input) return { text: input, changed: false };
  if (!isStructurePreserved(input, output)) {
    return { text: input, changed: false, rejected: 'integrity' };
  }
  return { text: output, changed: true };
}
