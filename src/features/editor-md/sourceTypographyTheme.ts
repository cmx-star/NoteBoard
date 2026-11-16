// 源码模式排版主题：行号与正文按内容宽度居中，宽度跟随代码编辑区设置
import { EditorView } from '@codemirror/view';

export function createSourceTypographyTheme() {
  return EditorView.theme({
    '&': {
      fontFamily: 'var(--mono-font-family)',
      fontSize: 'var(--mono-font-size)',
      height: 'var(--pct-100)',
    },
    '.cm-scroller': {
      lineHeight: 'var(--mono-line-height, 1.5)',
      fontFamily: 'var(--mono-font-family)',
      fontSize: 'var(--mono-font-size)',
      // 百分比按编辑器宽度计算：两侧留白 = (编辑器宽 - 内容宽) / 2
      paddingInline: 'max(var(--dim-0), calc((var(--pct-100) - var(--mono-max-width, var(--pct-100))) / 2))',
    },
    '.cm-content, .cm-line': {
      fontFamily: 'var(--mono-font-family)',
      fontSize: 'var(--mono-font-size)',
    },
    '.cm-content': {
      // 行号槽已有右边线分隔，左内边距取设置值的一半，避免正文被挤得过窄
      padding: 'var(--mono-padding-y, var(--dim-16)) var(--mono-padding-x, var(--dim-24)) var(--mono-padding-y, var(--dim-16)) calc(var(--mono-padding-x, var(--dim-24)) / 2)',
    },
  });
}

/** 沉浸阅读时源码视图只读（compartment 仅作标识，可在多个实例间共享） */
