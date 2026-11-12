// 中文排版格式化：对外入口

export { formatCjkMarkdown, CJK_FORMAT_MAX_LENGTH } from './format';
export { formatCjkText, formatCjkLine } from './rules';
export { splitProtectedSegments } from './segments';
export { isStructurePreserved } from './integrity';
export { DEFAULT_CJK_FORMAT_OPTIONS } from './types';
export type { CjkFormatOptions, CjkFormatResult, CjkFormatRejection } from './types';
