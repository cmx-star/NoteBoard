// 快捷键规范形与冲突检测

import { describe, expect, it, vi } from 'vitest';
import {
  chordFromDefinition,
  chordFromEvent,
  chordId,
  platformFromCommandKey,
} from '../../src/core/keybinding/canonicalChord';
import { findConflicts } from '../../src/core/keybinding/conflicts';
import { registerShortcut } from '../../src/core/shortcuts';

function event(overrides: Partial<Parameters<typeof chordFromEvent>[0]> = {}) {
  return {
    code: 'KeyA',
    key: 'a',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides,
  };
}

describe('chordFromDefinition', () => {
  it('Ctrl 在 macOS 解析为主修饰键', () => {
    expect(chordId(chordFromDefinition('Ctrl+S', 'mac')!)).toBe('Mod+S');
  });

  it('Ctrl 在非 macOS 同样解析为主修饰键', () => {
    expect(chordId(chordFromDefinition('Ctrl+S', 'other')!)).toBe('Mod+S');
  });

  it('Control 是字面 Control，与主修饰键区分', () => {
    expect(chordId(chordFromDefinition('Control+S', 'mac')!)).toBe('Ctrl+S');
  });

  it('Cmd / Command / Mod 等价', () => {
    const ids = ['Cmd+K', 'Command+K', 'Mod+K'].map(
      (definition) => chordId(chordFromDefinition(definition, 'mac')!),
    );
    expect(new Set(ids).size).toBe(1);
  });

  it('多修饰键顺序无关', () => {
    const a = chordId(chordFromDefinition('Shift+Alt+F', 'other')!);
    const b = chordId(chordFromDefinition('Alt+Shift+F', 'other')!);
    expect(a).toBe(b);
  });

  it('支持符号键与功能键', () => {
    expect(chordId(chordFromDefinition('Ctrl+/', 'other')!)).toBe('Mod+/');
    expect(chordId(chordFromDefinition('Shift+Alt+F', 'other')!)).toBe('Alt+Shift+F');
  });

  it('多和弦与空定义返回 null', () => {
    expect(chordFromDefinition('Ctrl+K Ctrl+O', 'other')).toBeNull();
    expect(chordFromDefinition('   ', 'other')).toBeNull();
  });
});

describe('chordFromEvent', () => {
  it('macOS 上 Command 解析为主修饰键', () => {
    expect(chordId(chordFromEvent(event({ metaKey: true }), 'mac')!)).toBe('Mod+A');
  });

  it('macOS 上 Control 是字面 Ctrl，不与 Command 合并', () => {
    expect(chordId(chordFromEvent(event({ ctrlKey: true }), 'mac')!)).toBe('Ctrl+A');
  });

  it('非 macOS 上 Ctrl 解析为主修饰键', () => {
    expect(chordId(chordFromEvent(event({ ctrlKey: true }), 'other')!)).toBe('Mod+A');
  });

  it('Option 组合键按物理键位识别，不受输入字符影响', () => {
    const chord = chordFromEvent(event({ code: 'KeyF', key: 'ƒ', altKey: true }), 'mac');
    expect(chordId(chord!)).toBe('Alt+F');
  });

  it('输入法把 key 变成 Process 时仍按 code 识别', () => {
    const chord = chordFromEvent(event({ code: 'KeyA', key: 'Process' }), 'other');
    expect(chordId(chord!)).toBe('A');
  });

  it('主键盘数字与小键盘数字身份不同', () => {
    const digit = chordId(chordFromEvent(event({ code: 'Digit1', key: '1' }), 'other')!);
    const numpad = chordId(chordFromEvent(event({ code: 'Numpad1', key: '1' }), 'other')!);
    expect(digit).not.toBe(numpad);
  });

  it('方向键与标点键使用规范名', () => {
    expect(chordId(chordFromEvent(event({ code: 'ArrowUp', key: 'ArrowUp' }), 'other')!)).toBe('ArrowUp');
    expect(chordId(chordFromEvent(event({ code: 'Slash', key: '/' }), 'other')!)).toBe('/');
  });
});

describe('定义与事件对齐', () => {
  it('Ctrl+S 的定义与 macOS Command+S 事件一致', () => {
    const definition = chordId(chordFromDefinition('Ctrl+S', 'mac')!);
    const runtime = chordId(chordFromEvent(event({ code: 'KeyS', key: 's', metaKey: true }), 'mac')!);
    expect(definition).toBe(runtime);
  });

  it('Shift+Alt+F 的定义与运行时事件一致', () => {
    const definition = chordId(chordFromDefinition('Shift+Alt+F', 'other')!);
    const runtime = chordId(
      chordFromEvent(event({ code: 'KeyF', key: 'F', shiftKey: true, altKey: true }), 'other')!,
    );
    expect(definition).toBe(runtime);
  });
});

describe('findConflicts', () => {
  it('同作用域同快捷键报冲突', () => {
    const conflicts = findConflicts(
      [
        { key: 'Ctrl+S', scope: 'global', description: '保存' },
        { key: 'Mod+S', scope: 'global', description: '另存' },
      ],
      'other',
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('Mod+S');
    expect(conflicts[0].bindings).toHaveLength(2);
  });

  it('不同作用域不算冲突', () => {
    const conflicts = findConflicts(
      [
        { key: 'Ctrl+F', scope: 'global' },
        { key: 'Ctrl+F', scope: 'editor' },
      ],
      'other',
    );
    expect(conflicts).toHaveLength(0);
  });

  it('不同修饰键不冲突', () => {
    const conflicts = findConflicts(
      [
        { key: 'Ctrl+S', scope: 'global' },
        { key: 'Control+S', scope: 'global' },
      ],
      'mac',
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe('platformFromCommandKey', () => {
  it('映射到 mac / other', () => {
    expect(platformFromCommandKey(true)).toBe('mac');
    expect(platformFromCommandKey(false)).toBe('other');
  });
});

describe('注册表冲突提示', () => {
  it('同作用域重复注册时输出一次开发态警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const disposeA = registerShortcut({
      key: 'Ctrl+Alt+9',
      action: () => {},
      scope: 'global',
      description: '测试 A',
    });
    const disposeB = registerShortcut({
      key: 'Mod+Alt+9',
      action: () => {},
      scope: 'global',
      description: '测试 B',
    });
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('快捷键冲突'))).toBe(true);

    disposeA();
    disposeB();
    warn.mockRestore();
  });
});
