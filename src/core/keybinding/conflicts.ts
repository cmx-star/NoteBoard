// 快捷键冲突检测：同一作用域下两个定义落到同一个规范形

import { chordFromDefinition, chordId, type PlatformId } from './canonicalChord';

export interface KeybindingLike {
  /** 定义串，如 `Ctrl+S` */
  key: string;
  /** 作用域：global / editor / explorer / outline */
  scope: string;
  /** 可选说明，仅用于冲突报告 */
  description?: string;
}

export interface KeybindingConflict {
  id: string;
  scope: string;
  bindings: KeybindingLike[];
}

/**
 * 返回同一作用域内重复的快捷键。
 * 无法解析的定义会按原始字符串分组，避免漏报。
 */
export function findConflicts(
  bindings: readonly KeybindingLike[],
  platform: PlatformId,
): KeybindingConflict[] {
  const groups = new Map<string, KeybindingLike[]>();

  for (const binding of bindings) {
    const chord = chordFromDefinition(binding.key, platform);
    const id = chord ? chordId(chord) : binding.key.trim().toUpperCase();
    const groupKey = `${binding.scope}\u0000${id}`;
    const list = groups.get(groupKey);
    if (list) list.push(binding);
    else groups.set(groupKey, [binding]);
  }

  const conflicts: KeybindingConflict[] = [];
  for (const [groupKey, list] of groups) {
    if (list.length < 2) continue;
    const separator = groupKey.indexOf('\u0000');
    conflicts.push({
      scope: groupKey.slice(0, separator),
      id: groupKey.slice(separator + 1),
      bindings: list,
    });
  }
  return conflicts;
}
