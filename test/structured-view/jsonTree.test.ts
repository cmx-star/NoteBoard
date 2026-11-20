// JSON 结构化视图：行模型与 package.json 语义摘要

import { describe, expect, it } from 'vitest';
import {
  buildJsonRows,
  childPath,
  describeValue,
  initialExpandedPaths,
  kindOf,
  parseJsonDocument,
  searchJsonRows,
  summarizePackageJson,
} from '../../src/features/structured-view/jsonTree';

describe('parseJsonDocument', () => {
  it('解析成功返回结构', () => {
    const result = parseJsonDocument('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('空文档给出明确提示', () => {
    expect(parseJsonDocument('   ')).toEqual({ ok: false, error: '文档为空' });
  });

  it('语法错误保留原始信息', () => {
    const result = parseJsonDocument('{');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('kindOf 与 describeValue', () => {
  it('区分六种 JSON 类型', () => {
    expect(kindOf(null)).toBe('null');
    expect(kindOf([])).toBe('array');
    expect(kindOf({})).toBe('object');
    expect(kindOf('x')).toBe('string');
    expect(kindOf(1)).toBe('number');
    expect(kindOf(true)).toBe('boolean');
  });

  it('容器显示条目数，字符串带引号', () => {
    expect(describeValue({ a: 1, b: 2 }, 'object')).toBe('{…} 2 项');
    expect(describeValue([1], 'array')).toBe('[…] 1 项');
    expect(describeValue('hi', 'string')).toBe('"hi"');
  });

  it('长字符串按上限截断', () => {
    const preview = describeValue('x'.repeat(100), 'string', 10);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(13);
  });
});

describe('buildJsonRows', () => {
  const value = {
    name: 'demo',
    list: [1, 2],
    nested: { deep: true },
  };

  it('未展开的容器只输出一行', () => {
    const { rows } = buildJsonRows(value, new Set(['$']));
    expect(rows.map((row) => row.path)).toEqual(['$', '$.name', '$.list', '$.nested']);
  });

  it('展开后输出子节点并带层级', () => {
    const { rows } = buildJsonRows(value, new Set(['$', '$.list', '$.nested']));
    const paths = rows.map((row) => row.path);
    expect(paths).toContain('$.list[0]');
    expect(paths).toContain('$.nested.deep');
    const child = rows.find((row) => row.path === '$.nested.deep');
    expect(child?.depth).toBe(2);
    expect(child?.kind).toBe('boolean');
  });

  it('超过行数上限时截断', () => {
    const big = Array.from({ length: 100 }, (_, index) => index);
    const result = buildJsonRows(big, new Set(['$']), { maxRows: 10 });
    expect(result.rows).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it('特殊键使用无歧义路径', () => {
    const { rows } = buildJsonRows({ 'a.b': 1 }, new Set(['$']));
    expect(rows[1].path).toBe('$["a.b"]');
  });
});

describe('initialExpandedPaths', () => {
  it('默认展开根与第一层容器', () => {
    const expanded = initialExpandedPaths({ a: { b: 1 }, c: [1], d: 2 });
    expect([...expanded].sort()).toEqual(['$', '$.a', '$.c']);
  });

  it('非对象只有根节点', () => {
    expect([...initialExpandedPaths([1, 2])]).toEqual(['$']);
  });
});

describe('summarizePackageJson', () => {
  it('识别依赖组与脚本数量', () => {
    const summary = summarizePackageJson({
      name: 'demo',
      version: '1.2.3',
      description: '示例',
      dependencies: { react: '19' },
      devDependencies: { vitest: '3' },
      scripts: { dev: 'vite', build: 'vite build' },
    });
    expect(summary).toMatchObject({
      name: 'demo',
      version: '1.2.3',
      scriptCount: 2,
    });
    expect(summary?.dependencyGroups.map((group) => group.count)).toEqual([1, 1]);
  });

  it('普通 JSON 不误判为 package.json', () => {
    expect(summarizePackageJson({ name: 'only-name' })).toBeNull();
    expect(summarizePackageJson({ dependencies: { a: '1' } })).toBeNull();
    expect(summarizePackageJson([1])).toBeNull();
  });
});

describe('childPath', () => {
  it('普通键用点号，特殊键用下标', () => {
    expect(childPath('$', 'name')).toBe('$.name');
    expect(childPath('$.a', 'b-c')).toBe('$.a["b-c"]');
  });
});

describe('searchJsonRows', () => {
  const value = {
    name: 'demo',
    scripts: { dev: 'vite', build: 'vite build' },
    deps: { react: '19.0.0', vue: '3.0.0' },
    list: [1, 2, 3],
  };

  it('空查询回退到默认展开视图', () => {
    const result = searchJsonRows(value, '   ');
    expect(result.active).toBe(false);
    expect(result.matched).toBe(0);
    expect(result.rows).toEqual(buildJsonRows(value, initialExpandedPaths(value)).rows);
  });

  it('按键命中并保留祖先路径', () => {
    const result = searchJsonRows(value, 'react');
    expect(result.active).toBe(true);
    expect(result.matched).toBe(1);
    expect(result.rows.map((row) => row.path)).toEqual(['$', '$.deps', '$.deps.react']);
    expect(result.rows[0].expanded).toBe(true);
  });

  it('容器命中时展开一层标量子级', () => {
    const result = searchJsonRows(value, 'scripts');
    expect(result.matched).toBe(1);
    expect(result.rows.map((row) => row.key)).toEqual([null, 'scripts', 'dev', 'build']);
  });

  it('值命中不区分大小写', () => {
    const result = searchJsonRows(value, 'VITE');
    expect(result.matched).toBe(2);
    expect(result.rows[result.rows.length - 1]?.path).toBe('$.scripts.build');
  });

  it('无命中返回空行', () => {
    const result = searchJsonRows(value, 'zzz');
    expect(result.matched).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it('遵守行数上限', () => {
    const big = { items: Array.from({ length: 50 }, (_, index) => ({ id: index })) };
    const result = searchJsonRows(big, 'id', { maxRows: 5 });
    expect(result.rows).toHaveLength(5);
    expect(result.truncated).toBe(true);
  });
});
