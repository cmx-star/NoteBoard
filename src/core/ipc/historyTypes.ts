// 文档历史记录相关 IPC 类型（从 types.ts 拆出，保持原有导出入口）

import type { Encoding } from './types';


/** 历史记录模式：关闭 / 仅本机 / 跨设备同步 */
export type HistoryMode = 'off' | 'local' | 'sync';

export interface HistoryConfigView {
  mode: HistoryMode;
  /** 保留天数，0 表示永久 */
  retentionDays: number;
  mergeWindowMin: number;
  /** 全部保留的天数，更早的版本每天只留一个 */
  fullKeepDays: number;
  /** 容量上限（MB），0 表示按模式默认 */
  maxTotalMb: number;
  effectiveMaxMb: number;
  /** 已开启多端同步（可选择跨设备同步） */
  syncAvailable: boolean;
  /** 同步服务为 Git 类仓库 */
  gitBackend: boolean;
}

export interface HistoryOptionsInput {
  retentionDays: number;
  mergeWindowMin: number;
  fullKeepDays: number;
  maxTotalMb: number;
}

export type HistoryReason =
  | 'initial'
  | 'save'
  | 'external'
  | 'before-sync'
  | 'sync-pull'
  | 'sync-merge'
  | 'before-restore'
  | 'restore';

export interface HistoryStats {
  ins: number;
  del: number;
  modified?: number;
  /** char 字符 / element 画板元素 / node 导图节点 / row 表格行 / cell 图形单元 */
  unit: string;
}

export interface HistoryEntry {
  id: string;
  start: number;
  at: number;
  hash: string;
  size: number;
  reason: HistoryReason;
  origin: { device: string; name: string };
  stats?: HistoryStats;
  restoredFrom?: string;
  pinned?: boolean;
  /** 合并窗口中（后续保存仍会并入这一版） */
  open?: boolean;
  isOwn: boolean;
}

export interface HistoryListResult {
  docId: string | null;
  kind: string;
  deviceId: string;
  /** 新到旧 */
  entries: HistoryEntry[];
}

export interface HistoryReadResult {
  content: string;
  encoding: Encoding;
  size: number;
}

export interface HistoryUsage {
  bytes: number;
  docs: number;
  entries: number;
}

export type HistoryCheckpointReason = 'close' | 'before-restore' | 'restore';
