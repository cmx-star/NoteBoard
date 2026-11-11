// NoteBoard 运行期文件删除提示
// 文件内容仍在内存时允许另存为；图片等无内存内容的只提供关闭标签。

import { useState } from 'react';
import { FileWarning } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { useWindowStore } from '../../stores/windowStore';
import { saveAs } from '../editor-code/orchestration/saveDocument';
import { syncDocumentContent } from '../editor-code/orchestration/syncDocumentContent';
import { discardStagedDocuments } from '../staging/stagingManager';
import { showToast } from '../../stores/toastStore';

export function MissingFileDialog() {
  const activeKey = useWindowStore((state) => state.activeKey);
  const activeTab = useWindowStore((state) => state.tabs.find((tab) => tab.key === state.activeKey));
  const document = useDocumentStore((state) => (activeKey ? state.documents.get(activeKey) : undefined));
  const [saving, setSaving] = useState(false);

  if (!activeKey || !activeTab?.isDetached || !document) return null;
  const canSaveAs = document.kind !== 'image' && document.kind !== 'preview' && document.kind !== 'unsupported';

  /** 从编辑器抓取最新内存内容后另存，成功时 saveAs 会迁移标签与文档 key。 */
  const handleSaveAs = async () => {
    setSaving(true);
    try {
      const latest = await syncDocumentContent(activeKey);
      const saved = await saveAs(activeKey, latest?.content ?? document.content ?? '');
      if (!saved) return;
      showToast('已将内存中的文件内容另存到新位置', 'success');
    } finally {
      setSaving(false);
    }
  };

  /** 关闭表示明确丢弃当前内存副本，同时清理本次异常保护暂存。 */
  const handleClose = async () => {
    await discardStagedDocuments([activeKey]);
    useWindowStore.getState().closeTab(activeKey);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-1200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--nb-black-a42)',
      }}
    >
      <div style={{ width: 'var(--dim-480)', maxWidth: '90vw', padding: 'var(--dim-22)', borderRadius: 'var(--radius-lg)', border: 'var(--dim-1) solid var(--editor-border)', background: 'var(--editor-surface)', boxShadow: 'var(--shadow-lg)', color: 'var(--editor-text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-10)', marginBottom: 'var(--dim-12)' }}>
          <FileWarning size={22} color="var(--error-500)" />
          <span style={{ fontSize: 'var(--text-16)', fontWeight: 'var(--weight-600)' }}>文件已被删除</span>
        </div>
        <div style={{ fontSize: 'var(--text-13)', lineHeight: 'var(--leading-1-7)', color: 'var(--editor-text-secondary)' }}>
          “{activeTab.displayName}”在 NoteBoard 运行期间已从原位置删除。
          {canSaveAs ? ' 当前编辑内容仍保留在内存中，可以另存到新位置。' : ' 当前格式没有可另存的内存内容。'}
        </div>
        <div style={{ marginTop: 'var(--dim-8)', fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', wordBreak: 'break-all' }}>
          原路径：{activeTab.path}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--dim-8)', marginTop: 'var(--dim-18)' }}>
          <button type="button" className="nb-btn-secondary" onClick={handleClose} disabled={saving}>关闭标签</button>
          {canSaveAs && (
            <button type="button" className="nb-btn-primary" onClick={handleSaveAs} disabled={saving}>
              {saving ? '正在另存' : '另存为'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
