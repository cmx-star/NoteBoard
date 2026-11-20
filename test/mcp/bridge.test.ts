// MCP 前端桥：文档类型映射与错误回包形状
// 不启动 Tauri 运行时；工具分发中尽早失败的路径可直接验证。

import { beforeEach, describe, expect, it } from 'vitest';
import { dispatchMcpTool, formatForKind, toBridgeError } from '@/features/mcp/bridge';
import { bumpDocumentRevision, resetEditorRegistryForTest } from '@/core/editor/editorRegistry';
import { useWindowStore, type Tab } from '@/stores/windowStore';

const markdownTab = {
  key: '/tmp/mcp-stale.md',
  displayName: 'mcp-stale.md',
  path: '/tmp/mcp-stale.md',
  kind: 'markdown',
  isDirty: false,
} as Tab;

describe('MCP bridge', () => {
  beforeEach(() => {
    useWindowStore.setState({ tabs: [], activeKey: null });
    resetEditorRegistryForTest();
  });

  it('maps only Markdown and code documents to editable formats', () => {
    expect(formatForKind('markdown')).toBe('markdown');
    expect(formatForKind('code')).toBe('text');
    expect(formatForKind('board')).toBeNull();
    expect(formatForKind('mindmap')).toBeNull();
    expect(formatForKind('bitable')).toBeNull();
    expect(formatForKind('image')).toBeNull();
  });

  it('rejects unknown tools with a structured error', async () => {
    await expect(dispatchMcpTool('noteboard_unknown', {})).rejects.toMatchObject({
      code: 'unknown_tool',
    });
  });

  it('rejects missing arguments before touching editor state', async () => {
    await expect(dispatchMcpTool('noteboard_read_document', {})).rejects.toMatchObject({
      code: 'invalid_arguments',
    });
    await expect(dispatchMcpTool('noteboard_write_document', { docKey: 'x' })).rejects.toMatchObject({
      code: 'invalid_arguments',
    });
  });

  it('normalizes known and unknown failures for mcp_respond', () => {
    expect(toBridgeError(new Error('boom'))).toEqual({
      code: 'internal_error',
      message: 'boom',
    });
    expect(toBridgeError('plain')).toEqual({
      code: 'internal_error',
      message: 'plain',
    });
  });

  it('rejects stale expectedRevision before touching the editor', async () => {
    useWindowStore.setState({ tabs: [markdownTab], activeKey: markdownTab.key });
    bumpDocumentRevision(markdownTab.key);

    await expect(dispatchMcpTool('noteboard_write_document', {
      docKey: markdownTab.key,
      content: '# 新内容',
      expectedRevision: 0,
    })).rejects.toMatchObject({ code: 'revision_mismatch' });
  });

  it('accepts a matching revision and then requires a mounted editor', async () => {
    useWindowStore.setState({ tabs: [markdownTab], activeKey: markdownTab.key });
    bumpDocumentRevision(markdownTab.key);

    await expect(dispatchMcpTool('noteboard_write_document', {
      docKey: markdownTab.key,
      content: '# 新内容',
      expectedRevision: 1,
    })).rejects.toMatchObject({ code: 'editor_not_ready' });
  });

  it('rejects non-integer expectedRevision', async () => {
    useWindowStore.setState({ tabs: [markdownTab], activeKey: markdownTab.key });

    await expect(dispatchMcpTool('noteboard_write_document', {
      docKey: markdownTab.key,
      content: 'x',
      expectedRevision: 1.5,
    })).rejects.toMatchObject({ code: 'invalid_arguments' });
  });
});
