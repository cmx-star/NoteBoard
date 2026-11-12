// 中文排版格式化：编辑器能力分发与提示

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  windowState: { activeKey: 'doc-1' as string | null },
  reading: false,
  capabilities: null as unknown,
  toasts: [] as Array<{ message: string; type?: string }>,
}));

vi.mock('../../src/stores/windowStore', () => ({
  useWindowStore: { getState: () => h.windowState },
}));

vi.mock('../../src/features/reading/readingMode', () => ({
  isDocumentReading: () => h.reading,
}));

vi.mock('../../src/core/editor/editorRegistry', () => ({
  getEditorCapabilities: () => h.capabilities,
}));

vi.mock('../../src/stores/toastStore', () => ({
  showToast: (message: string, type?: string) => {
    h.toasts.push({ message, type });
  },
}));

import { formatActiveDocumentCjk, runCjkFormatWithToast } from '../../src/features/cjkFormat/applyCjkFormat';

function makeCapabilities(selected: string, content: string | null) {
  return {
    docEditing: {
      replaceAll: vi.fn(),
      replaceSelection: vi.fn(),
    },
    getSelectedText: () => selected,
    flush: vi.fn(async () => (content === null ? null : { content })),
  };
}

describe('formatActiveDocumentCjk', () => {
  beforeEach(() => {
    h.windowState = { activeKey: 'doc-1' };
    h.reading = false;
    h.capabilities = null;
    h.toasts = [];
  });

  it('有选区时只格式化选区，不触发全文 flush', async () => {
    const capabilities = makeCapabilities('中文,abc', null);
    h.capabilities = capabilities;

    await expect(formatActiveDocumentCjk()).resolves.toBe('formatted');
    expect(capabilities.docEditing.replaceSelection).toHaveBeenCalledWith('中文，abc');
    expect(capabilities.docEditing.replaceAll).not.toHaveBeenCalled();
    expect(capabilities.flush).not.toHaveBeenCalled();
  });

  it('无选区时 flush 全文后整篇替换', async () => {
    const capabilities = makeCapabilities('', '使用TypeScript开发');
    h.capabilities = capabilities;

    await expect(formatActiveDocumentCjk()).resolves.toBe('formatted');
    expect(capabilities.flush).toHaveBeenCalledWith('save');
    expect(capabilities.docEditing.replaceAll).toHaveBeenCalledWith('使用 TypeScript 开发');
    expect(capabilities.docEditing.replaceSelection).not.toHaveBeenCalled();
  });

  it('排版已规范时不写回', async () => {
    const capabilities = makeCapabilities('中文，abc', null);
    h.capabilities = capabilities;

    await expect(formatActiveDocumentCjk()).resolves.toBe('unchanged');
    expect(capabilities.docEditing.replaceSelection).not.toHaveBeenCalled();
  });

  it('沉浸阅读模式直接拒绝', async () => {
    h.reading = true;
    h.capabilities = makeCapabilities('中文,abc', null);

    await expect(formatActiveDocumentCjk()).resolves.toBe('readonly');
  });

  it('编辑器不支持程序化编辑时返回不可用', async () => {
    h.capabilities = null;
    await expect(formatActiveDocumentCjk()).resolves.toBe('unavailable');
  });

  it('flush 失败时不覆盖正文', async () => {
    const capabilities = makeCapabilities('', null);
    h.capabilities = capabilities;

    await expect(formatActiveDocumentCjk()).resolves.toBe('unavailable');
    expect(capabilities.docEditing.replaceAll).not.toHaveBeenCalled();
  });
});

describe('runCjkFormatWithToast', () => {
  beforeEach(() => {
    h.windowState = { activeKey: 'doc-1' };
    h.reading = false;
    h.toasts = [];
  });

  it('成功时提示已格式化', async () => {
    h.capabilities = makeCapabilities('中文,abc', null);

    await expect(runCjkFormatWithToast()).resolves.toBe('formatted');
    expect(h.toasts).toEqual([{ message: '已格式化中文排版', type: 'success' }]);
  });

  it('无需修改时给出信息提示', async () => {
    h.capabilities = makeCapabilities('中文，abc', null);

    await expect(runCjkFormatWithToast()).resolves.toBe('unchanged');
    expect(h.toasts).toEqual([{ message: '排版已符合规则，无需修改', type: 'info' }]);
  });
});
