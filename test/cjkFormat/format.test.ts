// 中文排版格式化：规则、受保护区域与安全性

import { describe, expect, it } from 'vitest';
import {
  CJK_FORMAT_MAX_LENGTH,
  formatCjkMarkdown,
  splitProtectedSegments,
} from '../../src/features/cjkFormat';

const format = (text: string) => formatCjkMarkdown(text).text;

describe('CJK 间距', () => {
  it('中文与英文之间补空格', () => {
    expect(format('使用TypeScript开发')).toBe('使用 TypeScript 开发');
  });

  it('中文与数字之间补空格', () => {
    expect(format('共12个')).toBe('共 12 个');
  });

  it('已有空格时不重复补', () => {
    expect(format('使用 TypeScript 开发')).toBe('使用 TypeScript 开发');
  });

  it('支持扩展 B 区汉字（代理对）', () => {
    expect(format('𠀀a')).toBe('𠀀 a');
  });
});

describe('CJK 标点', () => {
  it('紧邻中文的半角逗号转全角', () => {
    expect(format('你好,世界')).toBe('你好，世界');
  });

  it('英文句子中的标点保持原样', () => {
    expect(format('Hello, world')).toBe('Hello, world');
  });

  it('数字上下文不转换：小数、时间、千分位', () => {
    expect(format('3.14')).toBe('3.14');
    expect(format('12:30')).toBe('12:30');
    expect(format('1,000')).toBe('1,000');
  });

  it('中文句末的半角句号转全角', () => {
    expect(format('这是结尾.')).toBe('这是结尾。');
  });

  it('文件名中的点不转换', () => {
    expect(format('Node.js中文')).toBe('Node.js 中文');
  });
});

describe('CJK 括号与省略号', () => {
  it('括号内有中文时转全角', () => {
    expect(format('(中文)')).toBe('（中文）');
  });

  it('括号内纯西文保持半角', () => {
    expect(format('(English)')).toBe('(English)');
  });

  it('三个半角点转中文省略号', () => {
    expect(format('等等...')).toBe('等等……');
  });

  it('与西文相邻的省略号保持原样', () => {
    expect(format('a...b')).toBe('a...b');
  });
});

describe('受保护区域', () => {
  it('行内代码不参与格式化，且两侧补空格', () => {
    expect(format('使用`npm install`安装')).toBe('使用 `npm install` 安装');
  });

  it('围栏代码块内部保持原样', () => {
    const input = ['中文,abc', '```js', 'const a = "中文,abc";', '```', '中文,abc'].join('\n');
    const expected = ['中文，abc', '```js', 'const a = "中文,abc";', '```', '中文，abc'].join('\n');
    expect(format(input)).toBe(expected);
  });

  it('未闭合的代码围栏保护到文末', () => {
    const input = ['中文,abc', '```', '中文,abc'].join('\n');
    const expected = ['中文，abc', '```', '中文,abc'].join('\n');
    expect(format(input)).toBe(expected);
  });

  it('链接目标不转换，链接文字正常转换', () => {
    expect(format('[中文,标题](docs/中文,文件.md)')).toBe(
      '[中文，标题](docs/中文,文件.md)',
    );
  });

  it('双向链接整体保护', () => {
    expect(format('[[中文,笔记]]')).toBe('[[中文,笔记]]');
  });

  it('YAML frontmatter 整体保护', () => {
    const input = ['---', 'title: 中文,abc', '---', '正文,abc'].join('\n');
    const expected = ['---', 'title: 中文,abc', '---', '正文，abc'].join('\n');
    expect(format(input)).toBe(expected);
  });

  it('裸 URL 不受标点规则影响', () => {
    expect(format('见https://example.com/a,b')).toBe('见 https://example.com/a,b');
  });

  it('HTML 实体不被改写', () => {
    expect(format('中文&nbsp;abc')).toBe('中文&nbsp;abc');
  });
});

describe('行首结构与安全边界', () => {
  it('有序列表标记中的点不当作句号', () => {
    expect(format('1. 中文,英文')).toBe('1. 中文，英文');
  });

  it('标题后正文正常格式化', () => {
    expect(format('## 使用API')).toBe('## 使用 API');
  });

  it('Markdown 硬换行的行尾空格保留', () => {
    expect(format('中文  \n下一行')).toBe('中文  \n下一行');
  });

  it('重复执行结果稳定（幂等）', () => {
    const input = '使用TypeScript开发,配合`npm`与[链接](a/b.md)...';
    const once = format(input);
    expect(format(once)).toBe(once);
  });

  it('关闭规则后不产生修改', () => {
    const result = formatCjkMarkdown('中文,abc', { punctuation: false });
    expect(result.changed).toBe(false);
    expect(result.text).toBe('中文,abc');
  });

  it('超长输入被拒绝且返回原文', () => {
    const input = '中'.repeat(CJK_FORMAT_MAX_LENGTH + 1);
    const result = formatCjkMarkdown(input);
    expect(result.rejected).toBe('too-large');
    expect(result.text).toBe(input);
  });
});

describe('分段', () => {
  it('正文与受保护段保持顺序拼接后可还原原文', () => {
    const input = '中文`code`abc\n```\nraw\n```\n尾';
    const joined = splitProtectedSegments(input)
      .map((segment) => segment.text)
      .join('');
    expect(joined).toBe(input);
  });
});
