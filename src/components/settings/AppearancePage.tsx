// 外观设置页：主题配色、界面材质、侧栏布局、标题栏按钮与实时预览
import { Check, PanelTop } from 'lucide-react';
import { useSettingsStore, useTitleBarButtons } from '../../stores/settingsStore';
import { getAllThemes, THEMES } from '../../core/theme/themes';
import { IS_MOBILE_UI, IS_WEB } from '../../core/platform';
import { supportsCompactMode } from '../../features/window/compactMode';
import { Tooltip } from '../Tooltip';
import type { MaterialStyle, TitleBarButtons } from '../../core/ipc/types';

const TITLE_BAR_BUTTON_OPTIONS: { key: keyof TitleBarButtons; label: string; available: () => boolean }[] = [
  { key: 'home', label: '回到主界面', available: () => true },
  { key: 'checkUpdate', label: '检查更新', available: () => !IS_WEB },
  { key: 'theme', label: '切换主题', available: () => true },
  { key: 'compactMode', label: '极窄模式', available: supportsCompactMode },
];

const MATERIAL_DESCRIPTIONS: Record<MaterialStyle, string> = {
  classic: '保留边框、分割线与常规投影，维持原有密度。',
  borderless: '移除边框与分割线，用留白、底色差和统一方向的光影分层。',
  candy: '在无边框基础上，把按钮与色板换成粉彩柔光的糖果质感。',
};

export function AppearancePage() {
  const { settings, resolvedTheme, setThemeMode, setMaterial, setLayout } = useSettingsStore();
  const titleBarButtons = useTitleBarButtons();
  const currentThemeMode = settings.appearance.themeMode;
  const currentMaterial: MaterialStyle = settings.appearance.material ?? 'classic';

  return (
              <div className="nb-appearance-page">
                <div className="nb-appearance-controls">
                  <div className="nb-appearance-heading">
                    <h3>主题配色方案</h3>
                    <span>选择后立即生效</span>
                  </div>

                <div data-setting-id="theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {getAllThemes().map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      title={theme.displayName}
                      desc={theme.description}
                      bg={theme.previewBg}
                      accent={theme.previewAccent}
                      codeBg={theme.previewCodeBg}
                      codeColor={theme.previewCodeText}
                      selected={currentThemeMode === theme.id}
                      onClick={() => setThemeMode(theme.id)}
                    />
                  ))}
                  {/* 跟随系统 */}
                  <ThemeCard
                    title="跟随系统"
                    desc={`当前生效: ${THEMES[resolvedTheme]?.displayName ?? resolvedTheme}`}
                    bg="linear-gradient(135deg, var(--nb-white) var(--pct-50), var(--editor-bg) var(--pct-50))"
                    accent="var(--nb-purple-500)"
                    codeBg="var(--editor-code-bg)"
                    codeColor="var(--hljs-comment)"
                    selected={currentThemeMode === 'system'}
                    onClick={() => setThemeMode('system')}
                  />
                </div>

                {/* 界面材质：无边框用留白与光影替代线条，糖果再给小块控件加粉彩柔光 */}
                <section>
                  <div className="nb-appearance-heading">
                    <h3>界面材质</h3>
                  </div>
                  <div className="nb-material-segmented" role="group" aria-label="界面材质">
                    <MaterialSegment
                      label="经典"
                      selected={currentMaterial === 'classic'}
                      onClick={() => setMaterial('classic')}
                    />
                    <MaterialSegment
                      label="无边框"
                      selected={currentMaterial === 'borderless'}
                      onClick={() => setMaterial('borderless')}
                    />
                    <MaterialSegment
                      label="糖果"
                      selected={currentMaterial === 'candy'}
                      onClick={() => setMaterial('candy')}
                    />
                  </div>
                  <p className="nb-material-hint">{MATERIAL_DESCRIPTIONS[currentMaterial]}</p>
                </section>

                {/* 侧栏布局：文件树与大纲互换，移动端不展示 */}
                {!IS_MOBILE_UI && (
                  <section>
                    <div className="nb-appearance-heading">
                      <h3>侧栏布局</h3>
                      <span>桌面端生效</span>
                    </div>
                    <div className="nb-material-segmented nb-sidebar-segmented" role="group" aria-label="侧栏布局">
                      <MaterialSegment
                        label="文件树在左"
                        selected={(settings.layout?.explorerSide ?? 'left') === 'left'}
                        onClick={() => setLayout({ explorerSide: 'left' })}
                      />
                      <MaterialSegment
                        label="大纲在左"
                        selected={settings.layout?.explorerSide === 'right'}
                        onClick={() => setLayout({ explorerSide: 'right' })}
                      />
                    </div>
                    <p className="nb-material-hint">
                      {(settings.layout?.explorerSide ?? 'left') === 'left'
                        ? '文件树在左，文档大纲在右。'
                        : '文档大纲在左，文件树在右。'}
                    </p>
                  </section>
                )}

                {/* 标题栏按钮：可选入口是否展示（移动端没有标题栏，不展示） */}
                {!IS_MOBILE_UI && (
                <div data-setting-id="titleBarButtons" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '18px 20px', background: 'var(--editor-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--editor-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                    <PanelTop size={15} color="var(--accent-strong)" />
                    <span>标题栏按钮</span>
                  </div>

                  {TITLE_BAR_BUTTON_OPTIONS.filter((option) => option.available()).map((option) => (
                    <div key={option.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                      <div>{option.label}</div>
                      <input
                        type="checkbox"
                        aria-label={`标题栏显示${option.label}`}
                        checked={titleBarButtons[option.key]}
                        onChange={(e) => setLayout({ titleBarButtons: { ...titleBarButtons, [option.key]: e.target.checked } })}
                      />
                    </div>
                  ))}
                </div>
                )}
                </div>

                <aside className="nb-appearance-preview">
                  <div className="nb-appearance-heading">
                    <h3>实时预览</h3>
                  </div>
                  <AppearancePreview />
                  <p className="nb-preview-note">主题与材质会同步应用到整个界面，包括菜单、弹窗和编辑器工具栏。</p>
                </aside>
              </div>
  );
}

function AppearancePreview() {
  return (
    <div className="nb-preview" aria-hidden="true">
      <div className="nb-preview-titlebar">
        <span className="nb-preview-dots"><i /><i /><i /></span>
        <span className="nb-preview-title">Loomark</span>
      </div>
      <div className="nb-preview-body">
        <div className="nb-preview-sidebar">
          <span className="nb-preview-nav is-active">笔记</span>
          <span className="nb-preview-nav">素材</span>
          <span className="nb-preview-nav">白板</span>
        </div>
        <div className="nb-preview-main">
          <div className="nb-preview-toolbar"><i /><i /><i /><i /></div>
          <span className="nb-preview-heading" />
          <span className="nb-preview-line" />
          <span className="nb-preview-line is-short" />
          <div className="nb-preview-card">
            <span className="nb-preview-line is-short" />
            <span className="nb-preview-line" />
          </div>
          <div className="nb-preview-search"><span /></div>
          <div className="nb-preview-actions">
            <span className="nb-btn-primary nb-preview-btn">新建</span>
            <span className="nb-btn-secondary nb-preview-btn">打开</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  title,
  desc,
  bg,
  accent,
  codeBg,
  codeColor,
  selected,
  onClick,
}: {
  title: string;
  desc: string;
  bg: string;
  accent: string;
  codeBg: string;
  codeColor: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        border: selected ? '2px solid var(--accent-strong)' : '1px solid var(--editor-border)',
        background: 'var(--editor-surface)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: selected ? 'var(--shadow-sm)' : 'none',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = selected ? 'var(--accent-strong)' : 'var(--editor-border-focus)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = selected ? 'var(--accent-strong)' : 'var(--editor-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = selected ? 'var(--shadow-sm)' : 'none';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
        {selected && <Check size={14} color="var(--accent-strong)" />}
      </div>
      <span style={{ fontSize: 11, color: 'var(--editor-text-muted)' }}>{desc}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
        <Tooltip content="背景色" side="top" sideOffset={4}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: bg, border: '1px solid var(--editor-border)', cursor: 'default' }} />
        </Tooltip>
        <Tooltip content="强调色" side="top" sideOffset={4}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: accent, border: '1px solid transparent', cursor: 'default' }} />
        </Tooltip>
        <Tooltip content="代码块色" side="top" sideOffset={4}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: codeBg, border: '1px solid var(--editor-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: codeColor, fontSize: 9, fontWeight: 'bold', cursor: 'default' }}>
            &lt;&gt;
          </div>
        </Tooltip>
      </div>
    </div>
  );
}

/** 材质分段按钮：只表达当前档位，不预览整套皮肤，避免和主题卡片重复 */
function MaterialSegment({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="nb-material-segment"
      data-selected={selected ? 'true' : 'false'}
      onClick={onClick}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}
