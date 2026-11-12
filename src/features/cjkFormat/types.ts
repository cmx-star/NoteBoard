// 中文排版格式化：对外类型与默认规则
// 参考 vmark cjkFormatter 的管线：受保护区域 → 分段 → 规则 → 完整性校验

/** 单次格式化启用的规则；默认全部开启，调用方可逐项关闭 */
export interface CjkFormatOptions {
  /** 中英文 / 中文与数字之间补空格 */
  spacing: boolean;
  /** 紧邻中文的半角标点转全角 */
  punctuation: boolean;
  /** 包裹中文的圆括号转全角 */
  brackets: boolean;
  /** 三个半角点转中文省略号 */
  ellipsis: boolean;
}

export const DEFAULT_CJK_FORMAT_OPTIONS: CjkFormatOptions = {
  spacing: true,
  punctuation: true,
  brackets: true,
  ellipsis: true,
};

/**
 * 拒绝原因：
 * - integrity：格式化前后内容骨架不一致，说明规则误伤了正文，整篇放弃
 * - too-large：超过单次处理上限，避免长文档卡住界面
 */
export type CjkFormatRejection = 'integrity' | 'too-large';

export interface CjkFormatResult {
  /** 始终返回可安全写回的文本；被拒绝时等于原文 */
  text: string;
  changed: boolean;
  rejected?: CjkFormatRejection;
}
