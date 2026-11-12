// NoteBoard 外观面板
// 主题选择 + 跟随系统 + UI 缩放
// 详见 docs/09-开发路线图.md 12.2

import { useSettingsStore } from '../../stores/settingsStore';
import { getAllThemes } from '../../core/theme/themes';
import type { ExplorerSide, MaterialStyle, ThemeId } from '../../core/ipc/types';

export function AppearancePanel() {
  const settings = useSettingsStore((s) => s.settings);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const setSystemLightTheme = useSettingsStore((s) => s.setSystemLightTheme);
  const setSystemDarkTheme = useSettingsStore((s) => s.setSystemDarkTheme);
  const setMaterial = useSettingsStore((s) => s.setMaterial);
  const setLayout = useSettingsStore((s) => s.setLayout);

  const material: MaterialStyle = settings.appearance.material ?? 'classic';

  const themes = getAllThemes();
  const lightThemes = themes.filter((theme) => theme.scheme === 'light');
  const darkThemes = themes.filter((theme) => theme.scheme === 'dark');

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--dim-12)',
    marginBottom: 'var(--dim-16)',
    fontSize: 'var(--text-13)',
  };

  const labelStyle: React.CSSProperties = { width: 'var(--dim-100)', flexShrink: 0 };

  return (
    <div>
      <h2 style={{ fontSize: 'var(--text-16)', marginTop: 0 }}>外观</h2>

      {/* 主题模式 */}
      <div style={rowStyle}>
        <span style={labelStyle}>主题模式</span>
        <select
          value={settings.appearance.themeMode}
          onChange={(e) => setThemeMode(e.target.value as 'system' | ThemeId)}
          style={selectStyle}
        >
          <option value="system">跟随系统</option>
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              始终{theme.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* 系统浅色主题 */}
      {settings.appearance.themeMode === 'system' && (
        <div style={rowStyle}>
          <span style={labelStyle}>系统浅色时</span>
          <select
            value={settings.appearance.systemLightTheme}
            onChange={(e) => setSystemLightTheme(e.target.value as ThemeId)}
            style={selectStyle}
          >
            {lightThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 系统深色主题 */}
      {settings.appearance.themeMode === 'system' && (
        <div style={rowStyle}>
          <span style={labelStyle}>系统深色时</span>
          <select
            value={settings.appearance.systemDarkTheme}
            onChange={(e) => setSystemDarkTheme(e.target.value as ThemeId)}
            style={selectStyle}
          >
            {darkThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 主题预览 */}
      <div style={rowStyle}>
        <span style={labelStyle}>可用主题</span>
        <div style={{ display: 'flex', gap: 'var(--dim-8)' }}>
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeMode(t.id)}
              aria-pressed={settings.appearance.themeMode === t.id}
              style={{
                width: 'var(--dim-48)',
                height: 'var(--dim-48)',
                borderRadius: 'var(--radius-md)',
                background: t.previewBg,
                border: `var(--dim-2) solid ${settings.appearance.themeMode === t.id ? t.previewAccent : 'var(--editor-border)'}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-11)',
                color: t.previewCodeText,
                padding: 0,
              }}
            >
              {t.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* 界面材质 */}
      <div style={rowStyle}>
        <span style={labelStyle}>界面材质</span>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value as MaterialStyle)}
          style={selectStyle}
        >
          <option value="classic">经典（有边框）</option>
          <option value="borderless">无边框（光影分层）</option>
          <option value="candy">糖果（无边框 + 糖果按钮）</option>
        </select>
      </div>

      {/* 桌面端侧栏布局：文件树与大纲互换 */}
      <div style={rowStyle}>
        <span style={labelStyle}>侧栏布局</span>
        <select
          value={settings.layout?.explorerSide ?? 'left'}
          onChange={(e) => setLayout({ explorerSide: e.target.value as ExplorerSide })}
          style={selectStyle}
        >
          <option value="left">文件树在左，大纲在右</option>
          <option value="right">大纲在左，文件树在右</option>
        </select>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: 'var(--dim-4) var(--dim-8)',
  fontSize: 'var(--text-13)',
  border: 'var(--dim-1) solid var(--editor-border)',
  borderRadius: 'var(--radius-xs)',
  background: 'var(--editor-surface)',
  color: 'var(--editor-text)',
  outline: 'none',
};
