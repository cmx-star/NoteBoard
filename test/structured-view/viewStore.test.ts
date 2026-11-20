// 结构化视图开关：只对 JSON 类文档生效，按文档绑定

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeKey: 'a' as string | null,
  tab: null as { kind: string; language: string } | null,
}));

vi.mock('../../src/stores/windowStore', () => ({
  useWindowStore: {
    getState: () => ({ activeKey: h.activeKey, activeTab: () => h.tab }),
  },
}));

import { supportsStructuredView, useViewStore } from '../../src/stores/viewStore';

describe('supportsStructuredView', () => {
  it('只接受 code + json', () => {
    expect(supportsStructuredView({ kind: 'code', language: 'json' })).toBe(true);
    expect(supportsStructuredView({ kind: 'code', language: 'yaml' })).toBe(false);
    expect(supportsStructuredView({ kind: 'markdown', language: 'markdown' })).toBe(false);
    expect(supportsStructuredView(null)).toBe(false);
  });
});

describe('useViewStore', () => {
  beforeEach(() => {
    useViewStore.setState({ structuredViewOpen: false, structuredViewDocKey: null });
    h.activeKey = 'a';
    h.tab = { kind: 'code', language: 'json' };
  });

  it('JSON 文档上切换打开与关闭', () => {
    useViewStore.getState().toggleStructuredView();
    expect(useViewStore.getState().structuredViewOpen).toBe(true);
    expect(useViewStore.getState().structuredViewDocKey).toBe('a');

    useViewStore.getState().toggleStructuredView();
    expect(useViewStore.getState().structuredViewOpen).toBe(false);
    expect(useViewStore.getState().structuredViewDocKey).toBeNull();
  });

  it('非 JSON 文档上强制关闭', () => {
    h.tab = { kind: 'code', language: 'yaml' };
    useViewStore.setState({ structuredViewOpen: true, structuredViewDocKey: 'a' });
    useViewStore.getState().toggleStructuredView();
    expect(useViewStore.getState().structuredViewOpen).toBe(false);
  });

  it('切换文档后按新文档重新打开', () => {
    useViewStore.getState().toggleStructuredView();
    h.activeKey = 'b';
    useViewStore.getState().toggleStructuredView();
    expect(useViewStore.getState().structuredViewOpen).toBe(true);
    expect(useViewStore.getState().structuredViewDocKey).toBe('b');
  });
});
