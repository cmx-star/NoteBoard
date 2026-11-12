// CJK 字符判定与相邻字符读取
// 只做码点级判断，不依赖任何编辑器内核

/** 是否是中文 / 日文 / 韩文正文用字（不含全角 ASCII 变体） */
export function isCjkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x2e80 && cp <= 0x2eff) || // 部首
    (cp >= 0x3000 && cp <= 0x303f) || // 中文标点
    (cp >= 0x3040 && cp <= 0x30ff) || // 假名
    (cp >= 0x3400 && cp <= 0x4dbf) || // 扩展 A
    (cp >= 0x4e00 && cp <= 0x9fff) || // 基本区
    (cp >= 0xf900 && cp <= 0xfaff) || // 兼容汉字
    (cp >= 0xac00 && cp <= 0xd7af) || // 韩文音节
    (cp >= 0x1100 && cp <= 0x11ff) || // 韩文字母
    (cp >= 0x20000 && cp <= 0x3ffff) // 扩展 B 及以后（代理对）
  );
}

/** 单字符版本，surrogate pair 也能正确判定 */
export function isCjkChar(char: string): boolean {
  if (!char) return false;
  const cp = char.codePointAt(0);
  return cp !== undefined && isCjkCodePoint(cp);
}

/** 是否可作为「西文」一侧参与间距判断：ASCII 字母数字 + 拉丁补充字母 */
export function isLatinishChar(char: string): boolean {
  if (!char) return false;
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x30 && cp <= 0x39) ||
    (cp >= 0x41 && cp <= 0x5a) ||
    (cp >= 0x61 && cp <= 0x7a) ||
    (cp >= 0xc0 && cp <= 0x24f)
  );
}

/** 文本中是否包含任意 CJK 字符 */
export function containsCjk(text: string): boolean {
  for (const char of text) {
    if (isCjkChar(char)) return true;
  }
  return false;
}
