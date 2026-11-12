// MCP 程序化编辑：Markdown 可视化内核的整篇写入、插入与格式化
// 使用真实 TipTap 编辑器与共享解析/序列化链路，避免只验证接口形状。

import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { buildCoreExtensions } from '@/features/editor-md/extensions/core';
import { registerMdTipTapEditor } from '@/features/editor-md/editorInstances';
import { createMarkdownEditorCapabilities } from '@/features/editor-md/editorCapabilities';
import { parseMarkdown, serializeMarkdown } from '@/features/editor-md/serialize';

const editors: Editor[] = [];
const disposers: Array<() => void> = [];

function createMarkdownEditor(docKey: string) {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: buildCoreExtensions(),
    content: '',
  });
  editors.push(editor);
  disposers.push(registerMdTipTapEditor(docKey, editor));
  expect(parseMarkdown(editor, '')).toBe(true);
  return { editor, capabilities: createMarkdownEditorCapabilities(docKey, 'test-instance') };
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  for (const editor of editors.splice(0)) editor.destroy();
});

describe('MCP Markdown 程序化编辑', () => {
  it('整篇写入按 Markdown 解析并保留格式', () => {
    const { editor, capabilities } = createMarkdownEditor('/tmp/mcp-write.md');
    capabilities.docEditing!.replaceAll('# 标题\n\n**粗体** 与 `代码`\n');

    const markdown = serializeMarkdown(editor);
    expect(markdown).toContain('# 标题');
    expect(markdown).toContain('**粗体**');
    expect(markdown).toContain('`代码`');
  });

  it('插入文本支持行内 Markdown 格式', () => {
    const { editor, capabilities } = createMarkdownEditor('/tmp/mcp-insert.md');
    capabilities.docEditing!.replaceAll('前缀\n');
    editor.commands.setTextSelection(3);
    capabilities.docEditing!.insertText('**加粗**');

    expect(serializeMarkdown(editor)).toContain('前缀**加粗**');
  });

  it('空替换内容会删除当前选区', () => {
    const { editor, capabilities } = createMarkdownEditor('/tmp/mcp-delete.md');
    capabilities.docEditing!.replaceAll('保留删除');
    editor.commands.setTextSelection({ from: 3, to: 5 });
    capabilities.docEditing!.replaceSelection('');

    expect(serializeMarkdown(editor)).toContain('保留');
    expect(serializeMarkdown(editor)).not.toContain('删除');
  });

  it('插入块级 Markdown 会在光标处生成对应结构', () => {
    const { editor, capabilities } = createMarkdownEditor('/tmp/mcp-block.md');
    capabilities.docEditing!.replaceAll('段落');
    editor.commands.setTextSelection(3);
    capabilities.docEditing!.insertText('\n- 项一\n- 项二\n');

    const markdown = serializeMarkdown(editor);
    expect(markdown).toContain('段落');
    expect(markdown).toContain('- 项一');
    expect(markdown).toContain('- 项二');
  });
});
