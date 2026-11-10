// Markdown 文档复制、剪切共用文件序列化规则，避免富文本 HTML 或缺少语法的正文进入剪贴板。
import { Extension, type Editor } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode, type ResolvedPos, type Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { getMarkdownManager, serializeMarkdownFromDoc } from './serialize';
import { customClipboardTextSerializer } from './tableClipboard';

/** 开放切片沿用祖先列表的起点，需加上选区前被裁掉的项数，避免复制第八项却输出第七项。 */
function restoreListStart(content: Fragment, from: ResolvedPos, openDepth: number, depth = 1): Fragment {
  const first = content.firstChild;
  if (!first || depth > openDepth || first.type !== from.node(depth).type) return content;
  const attrs = first.type.name === 'orderedList'
    ? { ...first.attrs, start: Number(first.attrs.start ?? 1) + from.index(depth) }
    : first.attrs;
  const children = restoreListStart(first.content, from, openDepth, depth + 1);
  return content.replaceChild(0, first.type.create(attrs, children, first.marks));
}

/** 表格首行是否包含表头单元格；只选数据行时首行是 tableRow。 */
function tableHasHeader(table: ProseMirrorNode): boolean {
  const firstRow = table.firstChild;
  if (!firstRow) return false;
  let hasHeader = false;
  firstRow.forEach((cell) => {
    if (cell.type.spec.tableRole === 'header_cell' || cell.type.name === 'tableHeader') hasHeader = true;
  });
  return hasHeader;
}

/** 给无表头的表格打上剪贴板标记：序列化时只输出数据行，不补空表头。 */
function markHeaderlessTable(node: ProseMirrorNode): ProseMirrorNode {
  if (node.type.spec.tableRole === 'table') {
    if (tableHasHeader(node)) return node;
    return node.type.create({ ...node.attrs, clipboardRowsOnly: true }, node.content, node.marks);
  }
  if (node.isLeaf) return node;
  let changed = false;
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    const next = markHeaderlessTable(child);
    if (next !== child) changed = true;
    children.push(next);
  });
  return changed ? node.copy(Fragment.fromArray(children)) : node;
}

function markClipboardTables(content: Fragment): Fragment {
  let changed = false;
  const children: ProseMirrorNode[] = [];
  content.forEach((node) => {
    const next = markHeaderlessTable(node);
    if (next !== node) changed = true;
    children.push(next);
  });
  return changed ? Fragment.fromArray(children) : content;
}

/** 将选区补成可独立序列化的文档；单元格选区等切片需要补回表格、段落或列表容器。 */
function serializeClipboardMarkdown(editor: Editor, slice: Slice): string {
  const { doc, schema, selection } = editor.state;
  let content = restoreListStart(slice.content, selection.$from, slice.openStart);
  for (let depth = selection.$from.depth; !doc.type.validContent(content) && depth > 0; depth -= 1) {
    const parent = selection.$from.node(depth);
    if (parent.type.validContent(content)) content = Fragment.from(parent.copy(content));
  }
  content = markClipboardTables(content);
  // 剪贴板片段不继承整份文件末尾的换行，正文中的空白和各节点源码属性仍交给共享流水线保留。
  // 整篇的顶层块原文记录只对应完整文档，片段一律按规则输出，结果不随复制范围变化。
  const fragmentDoc = doc.type.create({ ...doc.attrs, trailingNewline: '', sourceBlocks: null }, content);
  const manager = getMarkdownManager(editor);
  if (!manager) throw new Error('[NoteBoard] Markdown 剪贴板缺少 MarkdownManager');
  return serializeMarkdownFromDoc(manager, schema, fragmentDoc);
}

/** 右键「复制为纯文本」：表格选区按 TSV，其余按不带 Markdown 标记的纯文本。 */
export function serializeSelectionPlainText(editor: Editor): string {
  const { selection } = editor.state;
  if (selection.empty) return '';
  return customClipboardTextSerializer(selection.content(), editor.view);
}

/** 仅供 Markdown 文档启用；复制、剪切和右键菜单均经同一个原生剪贴板事件入口。 */
export const MarkdownClipboard = Extension.create({
  name: 'markdownClipboard',
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor;
    // 写入成功后才删除选区；只读模式让原生剪切保护生效，空选区不覆盖已有剪贴板。
    const writeSelection = (view: EditorView, event: ClipboardEvent): boolean => {
      const cut = event.type === 'cut';
      if ((cut && !view.editable) || view.state.selection.empty || !event.clipboardData) return false;
      const text = serializeClipboardMarkdown(editor, view.state.selection.content());
      event.clipboardData.clearData();
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
      if (cut) view.dispatch(view.state.tr.deleteSelection().scrollIntoView().setMeta('uiEvent', 'cut'));
      return true;
    };
    return [new Plugin({
      props: {
        handleDOMEvents: {
          copy: writeSelection,
          cut: writeSelection,
        },
      },
    })];
  },
});
