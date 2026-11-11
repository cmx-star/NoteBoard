// 从 globals.css 直接读取主题 Token，避免测试夹具与真实样式两套色值漂移。
// 只解析 :root[data-theme="..."] 顶层块中的单行自定义属性。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_IDS } from '@/core/theme/tokens';
import type { ThemeId } from '@/core/ipc/types';

function parseThemeTokens(css: string, themeId: ThemeId): Record<string, string> {
  const marker = `:root[data-theme="${themeId}"] {`;
  const start = css.indexOf(marker);
  if (start < 0) {
    throw new Error(`globals.css 缺少主题块: ${themeId}`);
  }
  const end = css.indexOf('\n}', start);
  if (end < 0) {
    throw new Error(`主题块未闭合: ${themeId}`);
  }

  const tokens: Record<string, string> = {};
  for (const line of css.slice(start, end).split('\n')) {
    for (const match of line.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      tokens[match[1]] = match[2].trim();
    }
  }
  return tokens;
}

const css = readFileSync(resolve('src/styles/globals.css'), 'utf8');

export const THEME_TOKENS = Object.fromEntries(
  THEME_IDS.map((themeId) => [themeId, parseThemeTokens(css, themeId)]),
) as Record<ThemeId, Record<string, string>>;
