// NoteBoard Excalidraw 主题映射
// 把已解析的 NoteBoard 主题映射到 Excalidraw 的 light/dark prop
// 详见 docs/09-开发路线图.md 10.3
//
// 素白/纸感/雾面都是 'light'，靠主题 CSS 变量区分
// viewBackgroundColor 不跟随主题（10.4）

import type { ThemeId } from '../../core/ipc/types';
import { normalizeThemeId, THEMES } from '../../core/theme/themes';

/** Excalidraw theme 类型 */
export type ExcalidrawTheme = 'light' | 'dark';

/**
 * 从 NoteBoard 主题名映射到 Excalidraw theme prop
 */
export function mapTheme(noteboardTheme: string): ExcalidrawTheme {
  const themeId: ThemeId = normalizeThemeId(noteboardTheme, 'su-bai');
  return THEMES[themeId].excalidrawTheme;
}

/** 中文字体回退配置 */
export const FONT_FAMILY_MAP = {
  // Excalidraw 字体 ID 映射
  1: 'Virgil, "Noto Sans SC", "Microsoft YaHei", sans-serif', // 手写体 + 中文回退
  2: 'Helvetica, "Noto Sans SC", "Microsoft YaHei", sans-serif', // 无衬线
  3: 'Cascadia Code, "JetBrains Mono", "Noto Sans Mono CJK SC", monospace', // 等宽
} as const;
