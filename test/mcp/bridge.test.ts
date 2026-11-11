// MCP 前端桥：文档类型映射与错误回包形状
// 不启动 Tauri 运行时；工具分发中尽早失败的路径可直接验证。

import { describe, expect, it } from 'vitest';
import { dispatchMcpTool, formatForKind, toBridgeError } from '@/features/mcp/bridge';

describe('MCP bridge', () => {
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
});
