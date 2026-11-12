// NoteBoard 文件拖拽释放提示浮层
// 当用户从外部将文件拖入 NoteBoard 窗口时展示视觉反馈
// 详见 docs/07-UI布局与交互规范.md

import { Files } from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';

export function FileDropOverlay() {
  const isDraggingFile = useLayoutStore((s) => s.isDraggingFile);

  if (!isDraggingFile) {
    return null;
  }

  return (
    // 全屏遮罩层：必须设置 pointerEvents: 'none'，防止阻断原生 WebView 拖拽事件
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-9999)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--dim-32)',
        boxSizing: 'border-box',
        backgroundColor: 'var(--nb-black-a45)',
        // 拖入反馈随指针持续变化，使用纯色遮罩避免每帧重新虚化整窗。
        animation: 'fadeIn var(--duration-150) ease-out',
      }}
    >
      {/* 拖拽释放视觉中心卡片 */}
      <div
        style={{
          width: 'var(--pct-100)',
          maxWidth: 'var(--dim-520)',
          padding: 'var(--dim-40) var(--dim-32)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          borderRadius: 'var(--radius-2xl)',
          background: 'var(--editor-surface)',
          border: 'var(--dim-2) dashed var(--editor-accent)',
          boxShadow: '0 var(--dim-12) var(--dim-36) var(--nb-black-a35)',
          gap: 'var(--dim-16)',
        }}
      >
        {/* 顶部图标 */}
        <div
          style={{
            width: 'var(--dim-64)',
            height: 'var(--dim-64)',
            borderRadius: 'var(--radius-2xl)',
            background: 'var(--editor-bg)',
            border: 'var(--dim-1) solid var(--editor-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--editor-accent)',
          }}
        >
          <Files size={32} />
        </div>

        {/* 标题 */}
        <div
          style={{
            fontSize: 'var(--text-18)',
            fontWeight: 'var(--weight-600)',
            color: 'var(--editor-heading)',
          }}
        >
          释放文件以在新标签页中打开
        </div>

        {/* 辅助说明 */}
        <div
          style={{
            fontSize: 'var(--text-13)',
            lineHeight: 'var(--leading-1-5)',
            color: 'var(--editor-text-secondary)',
            maxWidth: 'var(--dim-380)',
          }}
        >
          支持 Markdown 笔记、画板、代码、图片以及所有其他格式文件。
          <br />
          打开后自动在左侧菜单栏展开对应目录。
        </div>
      </div>
    </div>
  );
}
