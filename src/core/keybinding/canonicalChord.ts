// 快捷键规范形（Canonical Chord）
//
// 目标：同一套快捷键定义与运行时按键事件，推导出完全相同的标识。
// 关键点：
//   1. 按键身份取物理 `event.code`，输入法把 `event.key` 改成 `Process` 也不受影响。
//   2. 修饰键按平台解析：`Mod` 在 macOS 是 Command，其他平台是 Control。
//   3. 本项目既有语义：定义里的 `Ctrl` 在 macOS 上代表 Command（与 formatShortcut 的显示一致），
//      `Control` 才是字面 Control。
//
// 🔴 本模块当前只用于「冲突检测」，不参与按键分发；分发仍走 core/shortcuts.ts 的现有逻辑。

export type PlatformId = 'mac' | 'other';

export interface CanonicalChord {
  /** 平台主修饰键：macOS = Meta，其他 = Ctrl */
  mod: boolean;
  /** 字面 Ctrl（macOS 上是 Control） */
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** 字面 Meta（非 mac 平台的 Win 键 / Command 键） */
  meta: boolean;
  /** 规范按键名：`A`、`1`、`F5`、`ArrowUp`、`Numpad1`、`Slash` … */
  key: string;
}

export interface KeyboardEventLike {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** 由 code 推导出的规范按键名 */
const CODE_KEYS: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  Space: 'Space',
  Escape: 'Escape',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  NumpadDivide: 'Numpad/',
  NumpadMultiply: 'Numpad*',
  NumpadSubtract: 'Numpad-',
  NumpadAdd: 'Numpad+',
  NumpadDecimal: 'Numpad.',
  NumpadEnter: 'NumpadEnter',
};

/** 定义字符串里的按键别名 */
const DEFINITION_KEY_ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  space: 'Space',
  spacebar: 'Space',
  return: 'Enter',
  enter: 'Enter',
  del: 'Delete',
  delete: 'Delete',
  ins: 'Insert',
  insert: 'Insert',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  pgup: 'PageUp',
  pgdn: 'PageDown',
};

/** 符号键在定义里的写法 → 规范名 */
const SYMBOL_KEYS: Record<string, string> = {
  '-': '-',
  '=': '=',
  '[': '[',
  ']': ']',
  '\\': '\\',
  ';': ';',
  "'": "'",
  ',': ',',
  '.': '.',
  '/': '/',
  '`': '`',
};

function keyFromCode(code: string, fallbackKey: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  const mapped = CODE_KEYS[code];
  if (mapped) return mapped;

  if (!code || code === 'Unidentified') {
    if (fallbackKey.length === 1) return fallbackKey.toUpperCase();
    const alias = DEFINITION_KEY_ALIASES[fallbackKey.toLowerCase()];
    return alias ?? fallbackKey;
  }
  return code;
}

/** 定义串里的按键片段 → 规范名 */
function keyFromDefinition(token: string): string | null {
  if (!token) return null;
  if (token.length === 1) {
    if (SYMBOL_KEYS[token]) return SYMBOL_KEYS[token];
    return token.toUpperCase();
  }
  const upper = token.toUpperCase();
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(upper)) return upper;
  if (SYMBOL_KEYS[token]) return SYMBOL_KEYS[token];
  return DEFINITION_KEY_ALIASES[token.toLowerCase()] ?? upper;
}

/**
 * 解析快捷键定义。
 * 支持用空格分隔的多个和弦（chord）时返回 null——当前注册表只用单和弦。
 */
export function chordFromDefinition(definition: string, platform: PlatformId): CanonicalChord | null {
  const trimmed = definition.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const chord: CanonicalChord = {
    mod: false,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: '',
  };

  const tokens = trimmed.split('+');
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === 'mod' || lower === 'cmdorctrl' || lower === 'commandorcontrol') {
      chord.mod = true;
    } else if (lower === 'ctrl' || lower === 'cmd' || lower === 'command') {
      // 本项目约定：Ctrl / Cmd 都表示平台主修饰键
      chord.mod = true;
    } else if (lower === 'control') {
      chord.ctrl = true;
    } else if (lower === 'alt' || lower === 'option') {
      chord.alt = true;
    } else if (lower === 'shift') {
      chord.shift = true;
    } else if (lower === 'meta' || lower === 'super' || lower === 'win') {
      chord.meta = true;
    } else {
      const key = keyFromDefinition(token);
      if (key) chord.key = key;
    }
  }

  if (!chord.key) return null;
  // macOS 上 Meta 已作为主修饰键；显式 Meta 与 Mod 同时出现时合并
  if (platform === 'mac' && chord.meta) {
    chord.mod = true;
    chord.meta = false;
  }
  return chord;
}

/** 从键盘事件推导规范形；无法识别按键时返回 null */
export function chordFromEvent(
  event: KeyboardEventLike,
  platform: PlatformId,
): CanonicalChord | null {
  const key = keyFromCode(event.code, event.key);
  if (!key) return null;
  const isMac = platform === 'mac';
  return {
    mod: isMac ? event.metaKey : event.ctrlKey,
    ctrl: isMac ? event.ctrlKey : false,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: isMac ? false : event.metaKey,
    key,
  };
}

/** 稳定标识：修饰键顺序固定，可直接比较或用于 Map */
export function chordId(chord: CanonicalChord): string {
  const parts: string[] = [];
  if (chord.mod) parts.push('Mod');
  if (chord.ctrl) parts.push('Ctrl');
  if (chord.alt) parts.push('Alt');
  if (chord.shift) parts.push('Shift');
  if (chord.meta) parts.push('Meta');
  parts.push(chord.key);
  return parts.join('+');
}

/** 平台判定：本项目用 USES_COMMAND_KEY 表示 macOS 主修饰键 */
export function platformFromCommandKey(usesCommandKey: boolean): PlatformId {
  return usesCommandKey ? 'mac' : 'other';
}
