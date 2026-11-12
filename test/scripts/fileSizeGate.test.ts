// 文件行数棘轮：只降不升

import { describe, expect, it } from 'vitest';
// @ts-expect-error 门禁脚本是 .mjs，没有类型声明
import { FILE_SIZE_LIMIT, countLines, evaluateFileSizes } from '../../scripts/file-size-core.mjs';

describe('文件行数棘轮核心', () => {
  it('未登记且超过上限视为新增超限', () => {
    const violations = evaluateFileSizes({ 'src/a.ts': FILE_SIZE_LIMIT + 1 }, {}, FILE_SIZE_LIMIT);
    expect(violations).toEqual([`新增超限：src/a.ts（${FILE_SIZE_LIMIT + 1} 行 > ${FILE_SIZE_LIMIT}）`]);
  });

  it('未登记且未超限通过', () => {
    expect(evaluateFileSizes({ 'src/a.ts': FILE_SIZE_LIMIT }, {}, FILE_SIZE_LIMIT)).toEqual([]);
  });

  it('基线文件继续增长失败', () => {
    const violations = evaluateFileSizes({ 'src/a.ts': 520 }, { 'src/a.ts': 500 });
    expect(violations[0]).toContain('继续增长');
  });

  it('基线文件保持原行数通过', () => {
    expect(evaluateFileSizes({ 'src/a.ts': 500 }, { 'src/a.ts': 500 })).toEqual([]);
  });

  it('缩小但仍超限时必须下调基线', () => {
    const violations = evaluateFileSizes({ 'src/a.ts': 450 }, { 'src/a.ts': 500 });
    expect(violations[0]).toContain('未下调基线');
  });

  it('缩到上限以内必须移出基线', () => {
    const violations = evaluateFileSizes({ 'src/a.ts': 400 }, { 'src/a.ts': 500 });
    expect(violations[0]).toContain('可以移出基线');
  });

  it('基线中的文件已删除视为残留', () => {
    const violations = evaluateFileSizes({}, { 'src/gone.ts': 500 });
    expect(violations[0]).toContain('基线残留');
  });
});

describe('countLines', () => {
  it('与 wc -l 对齐', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(2);
  });
});
