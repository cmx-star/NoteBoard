// 把中文排版格式化接到当前活动文档
//
// 通过 core 编辑器能力注册表读写正文，不直接接触 TipTap / CodeMirror：
// - 有选区：只格式化选区，走 replaceSelection
// - 无选区：flush 捕获权威正文后整篇替换，走 replaceAll

import { getEditorCapabilities } from '../../core/editor/editorRegistry';
import { useWindowStore } from '../../stores/windowStore';
import { showToast } from '../../stores/toastStore';
import { isDocumentReading } from '../reading/readingMode';
import { formatCjkMarkdown } from './format';

export type CjkFormatOutcome =
  | 'formatted'
  | 'unchanged'
  | 'rejected'
  | 'readonly'
  | 'unavailable';

/** 格式化当前活动文档；返回结果码，UI 层据此提示 */
export async function formatActiveDocumentCjk(): Promise<CjkFormatOutcome> {
  const docKey = useWindowStore.getState().activeKey;
  if (!docKey) return 'unavailable';
  if (isDocumentReading(docKey)) return 'readonly';

  const capabilities = getEditorCapabilities(docKey);
  if (!capabilities?.docEditing) return 'unavailable';

  const selection = capabilities.getSelectedText();
  if (selection.trim()) {
    const result = formatCjkMarkdown(selection);
    if (result.rejected) return 'rejected';
    if (!result.changed) return 'unchanged';
    capabilities.docEditing.replaceSelection(result.text);
    return 'formatted';
  }

  const snapshot = await capabilities.flush('save');
  if (!snapshot || snapshot.content === null) return 'unavailable';

  const result = formatCjkMarkdown(snapshot.content);
  if (result.rejected) return 'rejected';
  if (!result.changed) return 'unchanged';
  capabilities.docEditing.replaceAll(result.text);
  return 'formatted';
}

const OUTCOME_MESSAGES: Record<CjkFormatOutcome, { text: string; type: 'success' | 'info' | 'warning' }> = {
  formatted: { text: '已格式化中文排版', type: 'success' },
  unchanged: { text: '排版已符合规则，无需修改', type: 'info' },
  rejected: { text: '排版校验未通过，文档保持不变', type: 'warning' },
  readonly: { text: '沉浸阅读模式不可修改正文', type: 'info' },
  unavailable: { text: '当前编辑器不支持修改正文', type: 'warning' },
};

/** 供快捷键与工具栏调用：执行并统一提示 */
export async function runCjkFormatWithToast(): Promise<CjkFormatOutcome> {
  const outcome = await formatActiveDocumentCjk();
  const message = OUTCOME_MESSAGES[outcome];
  showToast(message.text, message.type);
  return outcome;
}
