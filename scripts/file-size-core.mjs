// 文件行数棘轮的纯函数核心（无文件系统副作用，供 CLI 与单测共用）
//
// 规则只有一条：基线只能下降。
//   1. 未登记且超过上限 → 新增超限
//   2. 已登记但继续增长 → 回归
//   3. 已登记但不超限 → 必须移出基线
//   4. 已缩小但仍超限 → 必须下调基线数字

export const FILE_SIZE_LIMIT = 400;

/** 与 `wc -l` 对齐的行数统计 */
export function countLines(content) {
  if (!content) return 0;
  const newlines = content.match(/\n/g)?.length ?? 0;
  return content.endsWith('\n') ? newlines : newlines + 1;
}

/**
 * 比较当前行数与基线，返回人类可读的违规列表。
 * @param {Record<string, number>} current 当前文件 → 行数
 * @param {Record<string, number>} baseline 基线文件 → 行数
 * @param {number} limit 行数上限
 */
export function evaluateFileSizes(current, baseline, limit = FILE_SIZE_LIMIT) {
  const violations = [];

  for (const [file, lines] of Object.entries(current)) {
    const cap = baseline[file];
    if (cap === undefined) {
      if (lines > limit) {
        violations.push(`新增超限：${file}（${lines} 行 > ${limit}）`);
      }
      continue;
    }
    if (lines > cap) {
      violations.push(`继续增长：${file}（${lines} 行 > 基线 ${cap}）`);
    } else if (lines < cap && lines > limit) {
      violations.push(`已缩小但未下调基线：${file}（${lines} 行，基线仍为 ${cap}）`);
    }
  }

  for (const file of Object.keys(baseline)) {
    const lines = current[file];
    if (lines === undefined) {
      violations.push(`基线残留：${file} 已不存在，请移除`);
    } else if (lines <= limit) {
      violations.push(`可以移出基线：${file}（${lines} 行 ≤ ${limit}）`);
    }
  }

  return violations;
}
