// 「跟随系统」主题映射：浅色与深色分别使用设置中的 systemLightTheme / systemDarkTheme

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme } from '../../src/core/theme/applyTheme';

/** 模拟系统深浅色偏好 */
function mockPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? dark : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('跟随系统主题', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('浅色系统用 systemLightTheme，深色系统用 systemDarkTheme', () => {
    mockPrefersDark(false);
    expect(resolveTheme('system', 'su-bai', 'mo-hei')).toBe('su-bai');
    mockPrefersDark(true);
    expect(resolveTheme('system', 'su-bai', 'mo-hei')).toBe('mo-hei');
  });

  it('手动选择的主题不受系统偏好影响', () => {
    mockPrefersDark(true);
    expect(resolveTheme('zhi-gan', 'su-bai', 'mo-hei')).toBe('zhi-gan');
    expect(resolveTheme('su-bai', 'su-bai', 'mo-hei')).toBe('su-bai');
  });
});
