// NoteBoard 主题注册表
// 四套主题元信息（中文名、明暗分组、预览色）
// 设置界面与快捷菜单统一从这里读取，避免多处色值漂移

import type { ThemeId } from '../ipc/types';

export interface ThemeMeta {
  id: ThemeId;
  /** 中文显示名 */
  displayName: string;
  /** 一句话气质描述 */
  description: string;
  /** 明暗分组（Excalidraw 用） */
  scheme: 'light' | 'dark';
  /** 预览三色：[背景, 身份色, 指示色] */
  preview: [string, string, string];
  /** 设置页预览：界面底色 */
  previewBg: string;
  /** 设置页预览：强调色 */
  previewAccent: string;
  /** 设置页预览：代码块底色 */
  previewCodeBg: string;
  /** 设置页预览：代码块文字色 */
  previewCodeText: string;
  /** Excalidraw 的 theme prop */
  excalidrawTheme: 'light' | 'dark';
}

export const THEMES: Record<ThemeId, ThemeMeta> = {
  'su-bai': {
    id: 'su-bai',
    displayName: '素白',
    description: '冷白界面 · Material 蓝',
    scheme: 'light',
    preview: ['#ffffff', '#2563eb', '#00695c'],
    previewBg: '#ffffff',
    previewAccent: '#2563eb',
    previewCodeBg: '#f5f7fa',
    previewCodeText: '#00695c',
    excalidrawTheme: 'light',
  },
  'zhi-gan': {
    id: 'zhi-gan',
    displayName: '纸感',
    description: '暖纸书页 · 墨褐正文',
    scheme: 'light',
    preview: ['#fbf5e9', '#3f8179', '#75583a'],
    previewBg: '#f1eadc',
    previewAccent: '#3f8179',
    previewCodeBg: '#ece2d2',
    previewCodeText: '#75583a',
    excalidrawTheme: 'light',
  },
  'mo-hei': {
    id: 'mo-hei',
    displayName: '墨黑',
    description: '深墨底色 · Material 蓝',
    scheme: 'dark',
    preview: ['#11141a', '#82aaff', '#80cbc4'],
    previewBg: '#11141a',
    previewAccent: '#82aaff',
    previewCodeBg: '#171a21',
    previewCodeText: '#80cbc4',
    excalidrawTheme: 'dark',
  },
  'wu-mian': {
    id: 'wu-mian',
    displayName: '雾面',
    description: '雾灰界面 · 青绿留白',
    scheme: 'light',
    preview: ['#f3f6f7', '#3a7d7a', '#2f6f6b'],
    previewBg: '#f3f6f7',
    previewAccent: '#3a7d7a',
    previewCodeBg: '#e9eff0',
    previewCodeText: '#2f6f6b',
    excalidrawTheme: 'light',
  },
};

/** 获取主题元信息 */
export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEMES[id];
}

/** 获取全部主题列表（用于设置界面渲染） */
export function getAllThemes(): ThemeMeta[] {
  return Object.values(THEMES);
}

// 旧主题 ID → 新主题 ID。设置文件与本地缓存可能仍保留旧值，加载时统一迁移。
const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  'chen-guang': 'su-bai',
  'hu-po': 'zhi-gan',
  'mo-ye': 'mo-hei',
};

/** 把任意持久化值规范化为当前主题 ID；未知值回退到指定主题 */
export function normalizeThemeId(value: unknown, fallback: ThemeId): ThemeId {
  if (typeof value !== 'string') return fallback;
  if (value in THEMES) return value as ThemeId;
  return LEGACY_THEME_ALIASES[value] ?? fallback;
}
