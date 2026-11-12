// 格式化前后的内容骨架校验
//
// 只抹平「格式化本来就允许改变的东西」：空白、全角标点、中文省略号。
// 其余任何增删都视为规则误伤，整篇放弃并保留原文。

const FULLWIDTH_TO_ASCII: Record<string, string> = {
  '，': ',',
  '；': ';',
  '：': ':',
  '！': '!',
  '？': '?',
  '。': '.',
  '（': '(',
  '）': ')',
};

function skeleton(text: string): string {
  return text
    .replace(/……/g, '...')
    .replace(/[，；：！？。（）]/g, (char) => FULLWIDTH_TO_ASCII[char] ?? char)
    .replace(/\s+/g, '');
}

/** 骨架一致才允许写回 */
export function isStructurePreserved(before: string, after: string): boolean {
  return skeleton(before) === skeleton(after);
}
