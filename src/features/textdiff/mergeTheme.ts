// NoteBoard 文本对比差异高亮主题
// 覆盖 @codemirror/merge 默认配色：柔和红（左侧/原文）与绿（右侧/修改文）语义色，
// 采用低透明度底色方案（参照 VS Code diff 配色），明暗三主题下均可读
// 颜色取自主题变量 --diff-delete-border / --diff-insert-border 按比例混合透明色，随主题切换
// merge 视图外层高度/滚动与中缝采用按钮层样式见 TextDiffView 的 TEXT_DIFF_CSS

import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export const nbMergeDiffTheme: Extension = EditorView.theme(
  {
    // 差异行底色（cm-merge-a=左侧原文，cm-merge-b=右侧修改文）
    '&.cm-merge-a .cm-changedLine': { backgroundColor: 'color-mix(in srgb, var(--diff-delete-border) var(--pct-10), transparent)' },
    '&.cm-merge-b .cm-changedLine': { backgroundColor: 'color-mix(in srgb, var(--diff-insert-border) var(--pct-10), transparent)' },
    // 行内词级差异高亮
    '&.cm-merge-a .cm-changedText': { background: 'color-mix(in srgb, var(--diff-delete-border) var(--pct-35), transparent)', borderRadius: 'var(--radius-xs)' },
    '&.cm-merge-b .cm-changedText': { background: 'color-mix(in srgb, var(--diff-insert-border) var(--pct-32), transparent)', borderRadius: 'var(--radius-xs)' },
    // 内联删除文本（deletedChunk 占位中的删除内容）
    '.cm-deletedText': { background: 'color-mix(in srgb, var(--diff-delete-border) var(--pct-35), transparent)', borderRadius: 'var(--radius-xs)' },
    // 差异行 gutter 色条
    '&.cm-merge-a .cm-changedLineGutter, & .cm-deletedLineGutter': {
      backgroundColor: 'color-mix(in srgb, var(--diff-delete-border) var(--pct-50), transparent)',
    },
    '&.cm-merge-b .cm-changedLineGutter': { backgroundColor: 'color-mix(in srgb, var(--diff-insert-border) var(--pct-50), transparent)' },
    // 折叠相同行提示（点击展开；⦚ 装饰符沿用 merge 内置样式）
    '.cm-collapsedLines': {
      color: 'var(--editor-text-muted)',
      background: 'var(--editor-surface)',
      border: 'var(--dim-1) solid var(--editor-border)',
      borderRadius: 'var(--radius-sm)',
    },
  },
  { dark: false },
);
