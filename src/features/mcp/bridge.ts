// NoteBoard MCP 前端桥
//
// Rust 收到 MCP 工具调用后通过 nb://mcp-request 发给目标窗口；
// 这里把工具名映射到编辑器能力（core/editor 注册表），执行后回包。
// 不直接依赖 TipTap/CodeMirror：不同内核的差异由各编辑器自己的能力实现。

import type { UnlistenFn } from '@tauri-apps/api/event';
import { mcpRespond } from '../../core/ipc/commands';
import { onMcpRequest } from '../../core/ipc/events';
import { getDocumentRevision, getEditorCapabilities } from '../../core/editor/editorRegistry';
import type { McpBridgeRequest } from '../../core/ipc/types';
import { useDocumentStore } from '../../stores/documentStore';
import { useWindowStore, type Tab } from '../../stores/windowStore';

/** 支持 MCP 编辑的文档类型 → 内容格式 */
export function formatForKind(kind: Tab['kind']): 'markdown' | 'text' | null {
  if (kind === 'markdown') return 'markdown';
  if (kind === 'code') return 'text';
  return null;
}

class McpToolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
  }
}

function requireString(
  args: Record<string, unknown>,
  key: string,
  allowEmpty = false,
): string {
  const value = args[key];
  if (typeof value !== 'string') {
    throw new McpToolError('invalid_arguments', `缺少字符串参数：${key}`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new McpToolError('invalid_arguments', `${key} 不能为空`);
  }
  return value;
}

function requireTab(docKey: string): { tab: Tab; format: 'markdown' | 'text' } {
  const tab = useWindowStore.getState().getTab(docKey);
  if (!tab) {
    throw new McpToolError('document_not_found', `文档未打开：${docKey}`);
  }
  const format = formatForKind(tab.kind);
  if (!format) {
    throw new McpToolError(
      'unsupported_document',
      `当前文档类型（${tab.kind}）不支持 MCP 编辑；支持 Markdown、代码与纯文本`,
    );
  }
  return { tab, format };
}

function requireEditing(docKey: string) {
  const capabilities = getEditorCapabilities(docKey);
  if (!capabilities?.docEditing) {
    throw new McpToolError(
      'editor_not_ready',
      '编辑器尚未挂载或不支持程序化编辑，请先激活对应标签并等待加载完成',
    );
  }
  return capabilities;
}

function editResult(docKey: string, previousRevision: number) {
  return {
    docKey,
    previousRevision,
    revision: getDocumentRevision(docKey),
    dirty: useWindowStore.getState().getTab(docKey)?.isDirty ?? false,
  };
}

function listDocuments() {
  const { tabs, activeKey } = useWindowStore.getState();
  return {
    documents: tabs.map((tab) => {
      const format = formatForKind(tab.kind);
      return {
        docKey: tab.key,
        title: tab.displayName,
        path: tab.path,
        kind: tab.kind,
        format,
        supported: format !== null,
        mounted: Boolean(getEditorCapabilities(tab.key)?.docEditing),
        active: tab.key === activeKey,
        dirty: tab.isDirty,
        canSave: Boolean(tab.path),
        viewMode: tab.viewMode,
      };
    }),
  };
}

async function readDocument(args: Record<string, unknown>) {
  const docKey = requireString(args, 'docKey');
  const { tab, format } = requireTab(docKey);
  const capabilities = getEditorCapabilities(docKey);
  let content: string | null = null;

  if (capabilities) {
    const snapshot = await capabilities.flush('save');
    if (snapshot && snapshot.content !== null) content = snapshot.content;
  }
  if (content === null) {
    content = useDocumentStore.getState().getDocument(docKey)?.content ?? null;
  }
  if (content === null) {
    throw new McpToolError('document_not_loaded', '文档正文尚未加载，请先激活该标签后再读取');
  }

  return {
    docKey,
    title: tab.displayName,
    path: tab.path,
    kind: tab.kind,
    format,
    revision: getDocumentRevision(docKey),
    dirty: tab.isDirty,
    content,
  };
}

function writeDocument(args: Record<string, unknown>) {
  const docKey = requireString(args, 'docKey');
  const content = requireString(args, 'content', true);
  const { format } = requireTab(docKey);
  if (args.format !== undefined && args.format !== format) {
    throw new McpToolError('format_mismatch', `该文档应使用 ${format} 格式写入`);
  }

  const expectedRevision = args.expectedRevision;
  if (
    expectedRevision !== undefined
    && (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0)
  ) {
    throw new McpToolError('invalid_arguments', 'expectedRevision 必须是非负整数');
  }
  const previousRevision = getDocumentRevision(docKey);
  if (typeof expectedRevision === 'number' && expectedRevision !== previousRevision) {
    throw new McpToolError(
      'revision_mismatch',
      `文档版本已变化（期望 ${expectedRevision}，当前 ${previousRevision}），请重新读取后再写入`,
    );
  }

  const editing = requireEditing(docKey).docEditing;
  if (!editing) throw new McpToolError('editor_not_ready', '编辑器不支持程序化编辑');
  editing.replaceAll(content);
  return editResult(docKey, previousRevision);
}

function insertText(args: Record<string, unknown>) {
  const docKey = requireString(args, 'docKey');
  const text = requireString(args, 'text', true);
  requireTab(docKey);
  const previousRevision = getDocumentRevision(docKey);
  const editing = requireEditing(docKey).docEditing;
  if (!editing) throw new McpToolError('editor_not_ready', '编辑器不支持程序化编辑');
  editing.insertText(text);
  return editResult(docKey, previousRevision);
}

function replaceSelection(args: Record<string, unknown>) {
  const docKey = requireString(args, 'docKey');
  const text = requireString(args, 'text', true);
  requireTab(docKey);
  const previousRevision = getDocumentRevision(docKey);
  const editing = requireEditing(docKey).docEditing;
  if (!editing) throw new McpToolError('editor_not_ready', '编辑器不支持程序化编辑');
  editing.replaceSelection(text);
  return editResult(docKey, previousRevision);
}

async function saveDocumentTool(args: Record<string, unknown>) {
  const docKey = requireString(args, 'docKey');
  const { tab } = requireTab(docKey);
  if (!tab.path) {
    throw new McpToolError('unsaved_document', '文档尚未命名，无法通过 MCP 保存；请先在界面中另存为');
  }
  const { saveDocument } = await import('../editor-code/orchestration/saveDocument');
  const saved = await saveDocument(docKey);
  return {
    docKey,
    saved,
    revision: getDocumentRevision(docKey),
    dirty: useWindowStore.getState().getTab(docKey)?.isDirty ?? false,
  };
}

/** 执行一次工具调用；供桥接与测试共用 */
export async function dispatchMcpTool(tool: string, argumentsValue: Record<string, unknown>) {
  switch (tool) {
    case 'noteboard_list_documents':
      return listDocuments();
    case 'noteboard_read_document':
      return readDocument(argumentsValue);
    case 'noteboard_write_document':
      return writeDocument(argumentsValue);
    case 'noteboard_insert_text':
      return insertText(argumentsValue);
    case 'noteboard_replace_selection':
      return replaceSelection(argumentsValue);
    case 'noteboard_save_document':
      return saveDocumentTool(argumentsValue);
    default:
      throw new McpToolError('unknown_tool', `未知工具：${tool}`);
  }
}

/** 把异常转换为前端回包使用的结构化错误 */
export function toBridgeError(error: unknown): { code: string; message: string } {
  if (error instanceof McpToolError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'internal_error',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function handleRequest(request: McpBridgeRequest): Promise<void> {
  try {
    const data = await dispatchMcpTool(request.tool, request.arguments ?? {});
    await mcpRespond({ requestId: request.requestId, ok: true, data }).catch((respondError) => {
      console.warn('MCP 回包失败:', respondError);
    });
  } catch (error) {
    await mcpRespond({
      requestId: request.requestId,
      ok: false,
      error: toBridgeError(error),
    }).catch((respondError) => {
      console.warn('MCP 回包失败:', respondError);
    });
  }
}

/** 每个窗口启动时注册一次；返回清理函数 */
export function startMcpBridge(): Promise<UnlistenFn> {
  return onMcpRequest((request) => {
    void handleRequest(request);
  });
}
