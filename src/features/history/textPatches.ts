// 文档历史补丁原语：计算、应用与反转相邻文本的最小替换补丁

export interface TextPatch {
  prefixLen: number;
  removed: string;
  inserted: string;
}

/** 计算相邻两个文本的最小替换补丁（最长公共前/后缀；UTF-16 code unit 逐字一致） */
export function diffText(prev: string, next: string): TextPatch {
  const maxPrefix = Math.min(prev.length, next.length);
  let prefixLen = 0;
  while (prefixLen < maxPrefix && prev.charCodeAt(prefixLen) === next.charCodeAt(prefixLen)) {
    prefixLen += 1;
  }
  // 前后缀不重叠：公共后缀最多延伸到 prefixLen
  let suffixLen = 0;
  const maxSuffix = maxPrefix - prefixLen;
  while (
    suffixLen < maxSuffix &&
    prev.charCodeAt(prev.length - 1 - suffixLen) === next.charCodeAt(next.length - 1 - suffixLen)
  ) {
    suffixLen += 1;
  }
  return {
    prefixLen,
    removed: prev.slice(prefixLen, prev.length - suffixLen),
    inserted: next.slice(prefixLen, next.length - suffixLen),
  };
}

/** 应用补丁：基于前一节点内容重建本节点内容 */
export function applyPatch(base: string, patch: TextPatch): string {
  return base.slice(0, patch.prefixLen) + patch.inserted + base.slice(patch.prefixLen + patch.removed.length);
}

/** 取补丁的逆（撤销方向重放用） */
export function reversePatch(patch: TextPatch): TextPatch {
  return { prefixLen: patch.prefixLen, removed: patch.inserted, inserted: patch.removed };
}

