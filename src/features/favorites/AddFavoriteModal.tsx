// NoteBoard 添加/编辑收藏夹模态弹窗
// 支持设置收藏名称、所属目标文件夹、内联快速新建文件夹、已有收藏移除与保存

import { useState, useEffect, useRef, useId } from 'react';
import { Star, Folder, X, Trash2, Check, FolderPlus } from 'lucide-react';
import { useFavoritesStore } from './favoritesStore';
import { getAllFolders, findFavoriteByPath, findParentFolder } from './favoritesUtils';
import { showToast } from '../../stores/toastStore';
import { Tooltip } from '../../components/Tooltip';
import { IS_MOBILE_UI } from '../../core/platform';
import { useBackDismiss } from '../../mobile/components';

export function AddFavoriteModal() {
  const {
    data,
    addModalState,
    closeAddModal,
    addFavorite,
    removeFavorite,
    createFolder,
  } = useFavoritesStore();

  const { open, target, initialFolderId } = addModalState;
  // 移动端返回键只关闭收藏弹窗；使用独立 ID 关联标题、表单标签，允许移动端输入框正常聚焦。
  const dialogId = useId();
  useBackDismiss(IS_MOBILE_UI && open, closeAddModal);

  const [name, setName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('root');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isFavorited, setIsFavorited] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // 所有文件夹层级扁平列表
  const folderOptions = getAllFolders(data.roots);

  // 弹窗打开时回显数据
  useEffect(() => {
    if (open && target) {
      const targetPath = target.path || '';
      // 只在打开或切换收藏目标时读取快照；新建文件夹导致 roots 变化时不能重置用户正在编辑的表单。
      const roots = useFavoritesStore.getState().data.roots;
      const existing = targetPath ? findFavoriteByPath(roots, targetPath) : null;

      if (existing) {
        setIsFavorited(true);
        setExistingId(existing.id);
        setName(existing.name);
        const parent = findParentFolder(roots, existing.id);
        setSelectedFolderId(parent ? parent.id : initialFolderId || 'root');
      } else {
        setIsFavorited(false);
        setExistingId(null);
        const defaultName = target.displayName || target.name || (targetPath.split(/[\\/]/).pop() ?? '未命名文档');
        setName(defaultName);
        setSelectedFolderId(initialFolderId || 'root');
      }

      setIsCreatingFolder(false);
      setNewFolderName('');

      const timer = window.setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [open, target, initialFolderId]);

  // 全局 Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeAddModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeAddModal]);

  if (!open || !target) return null;

  const targetPath = target.path || '';

  // 确认提交添加或更新收藏
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetPath) {
      showToast('未命名或内存文档暂无法加入收藏夹', 'warning');
      closeAddModal();
      return;
    }

    const finalName = name.trim() || (targetPath.split(/[\\/]/).pop() ?? '未命名文档');
    await addFavorite(selectedFolderId, finalName, targetPath);
    showToast(isFavorited ? '已更新收藏' : '已添加到收藏夹', 'success');
    closeAddModal();
  };

  // 移除该收藏项
  const handleRemove = async () => {
    if (existingId) {
      await removeFavorite(existingId);
      showToast('已从收藏夹移除', 'info');
    }
    closeAddModal();
  };

  // 创建新文件夹并自动选中
  const handleCreateNewFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreatingFolder(false);
      return;
    }
    const createdId = await createFolder(selectedFolderId, trimmed);
    setSelectedFolderId(createdId);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  return (
    <div
      className="nb-add-favorite-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-9996)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--nb-black-a45)',
        // 保留遮罩层次，取消覆盖整窗的实时背景虚化，避免悬停与表单编辑引发大面积合成。
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          closeAddModal();
        }
      }}
    >
      <div
        className="nb-add-favorite-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        style={{
          width: 'var(--dim-440)',
          maxWidth: '92vw',
          background: 'var(--editor-surface)',
          border: 'var(--dim-1) solid var(--editor-border)',
          borderRadius: 'var(--radius-lg, var(--dim-8))',
          boxShadow: '0 var(--dim-12) var(--dim-32) calc(var(--dim-4) * -1) var(--nb-black-a18), 0 var(--dim-4) var(--dim-12) calc(var(--dim-2) * -1) var(--nb-black-a08)',
          overflow: 'hidden',
          color: 'var(--editor-text)',
          fontFamily: 'var(--ui-font-family, sans-serif)',
          fontSize: 'var(--ui-font-size, var(--dim-13))',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--dim-12) var(--dim-16)',
            borderBottom: 'var(--dim-1) solid var(--editor-border)',
            background: 'var(--editor-bg)',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-8)' }}>
            <Star
              size={16}
              style={{
                color: 'var(--nb-orange-500)',
                fill: isFavorited ? 'var(--nb-orange-500)' : 'none',
              }}
            />
            <span id={`${dialogId}-title`} style={{ fontWeight: 'var(--weight-600)', fontSize: 'var(--text-14)' }}>
              {isFavorited ? '编辑收藏' : '添加到收藏夹'}
            </span>
          </div>
          <Tooltip content="关闭 (Esc)" side="bottom" sideOffset={4}>
            <button
              type="button"
              onClick={closeAddModal}
              aria-label="关闭"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--editor-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--dim-4)',
                borderRadius: 'var(--radius-sm, var(--dim-4))',
                transition: 'all var(--transition-fast, var(--duration-150) ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--toolbar-hover)';
                e.currentTarget.style.color = 'var(--editor-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--editor-text-muted)';
              }}
            >
              <X size={15} />
            </button>
          </Tooltip>
        </div>

        {/* 表单输入区域 */}
        <form className="nb-add-favorite-form" onSubmit={handleSave} style={{ padding: 'var(--dim-16)', display: 'flex', flexDirection: 'column', gap: 'var(--dim-14)' }}>
          {/* 名称输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-6)' }}>
            <label
              htmlFor={`${dialogId}-name`}
              style={{
                fontSize: 'var(--text-12)',
                fontWeight: 'var(--weight-500)',
                color: 'var(--editor-text-secondary)',
              }}
            >
              名称
            </label>
            <input
              id={`${dialogId}-name`}
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="收藏名称"
              style={{
                height: 'var(--dim-32)',
                padding: '0 var(--dim-10)',
                borderRadius: 'var(--radius-md, var(--dim-6))',
                border: 'var(--dim-1) solid var(--editor-border)',
                background: 'var(--editor-bg)',
                color: 'var(--editor-text)',
                fontSize: 'var(--text-13)',
                outline: 'none',
                transition: 'all var(--transition-fast, var(--duration-150) ease)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--editor-border-focus)';
                e.currentTarget.style.background = 'var(--editor-surface)';
                e.currentTarget.style.boxShadow = '0 0 0 var(--dim-2) var(--focus-ring)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--editor-border)';
                e.currentTarget.style.background = 'var(--editor-bg)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* 路径展示 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-6)' }}>
            <label
              style={{
                fontSize: 'var(--text-12)',
                fontWeight: 'var(--weight-500)',
                color: 'var(--editor-text-secondary)',
              }}
            >
              路径
            </label>
            <Tooltip content={targetPath || '未保存文件'} side="top" sideOffset={4}>
              <div
                style={{
                  padding: 'var(--dim-6) var(--dim-10)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  border: 'var(--dim-1) solid var(--editor-border)',
                  background: 'var(--editor-bg)',
                  color: 'var(--editor-text-muted)',
                  fontSize: 'var(--text-12)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  userSelect: 'text',
                }}
              >
                {targetPath || '未保存文件'}
              </div>
            </Tooltip>
          </div>

          {/* 文件夹选择 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                htmlFor={`${dialogId}-folder`}
                style={{
                  fontSize: 'var(--text-12)',
                  fontWeight: 'var(--weight-500)',
                  color: 'var(--editor-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--dim-5)',
                }}
              >
                <Folder size={13} style={{ opacity: 'var(--opacity-0-8)' }} />
                <span>文件夹</span>
              </label>

              {!isCreatingFolder && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFolder(true);
                    setTimeout(() => newFolderInputRef.current?.focus(), 50);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--dim-3)',
                    background: 'transparent',
                    border: 'none',
                    padding: 'var(--dim-2) var(--dim-6)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-11)',
                    color: 'var(--editor-accent)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--toolbar-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <FolderPlus size={12} />
                  <span>新建文件夹</span>
                </button>
              )}
            </div>

            {/* 内联新建文件夹输入框 */}
            {isCreatingFolder && (
              <div className="nb-add-favorite-create-row" style={{ display: 'flex', gap: 'var(--dim-6)', alignItems: 'center', marginBottom: 'var(--dim-2)' }}>
                <input
                  ref={newFolderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="文件夹名称"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateNewFolder();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsCreatingFolder(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    height: 'var(--dim-28)',
                    padding: '0 var(--dim-8)',
                    borderRadius: 'var(--radius-sm)',
                    border: 'var(--dim-1) solid var(--editor-border-focus)',
                    background: 'var(--editor-surface)',
                    color: 'var(--editor-text)',
                    fontSize: 'var(--text-12)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  aria-label="确认新建文件夹"
                  onClick={handleCreateNewFolder}
                  style={{
                    padding: '0 var(--dim-8)',
                    height: 'var(--dim-28)',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--accent-strong)',
                    color: 'var(--nb-white)',
                    fontSize: 'var(--text-12)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  aria-label="取消新建文件夹"
                  onClick={() => setIsCreatingFolder(false)}
                  style={{
                    padding: '0 var(--dim-8)',
                    height: 'var(--dim-28)',
                    borderRadius: 'var(--radius-sm)',
                    border: 'var(--dim-1) solid var(--control-border)',
                    background: 'transparent',
                    color: 'var(--editor-text-muted)',
                    fontSize: 'var(--text-12)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* 下拉选择框 */}
            <select
              id={`${dialogId}-folder`}
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              style={{
                height: 'var(--dim-32)',
                padding: '0 var(--dim-8)',
                borderRadius: 'var(--radius-md, var(--dim-6))',
                border: 'var(--dim-1) solid var(--editor-border)',
                background: 'var(--editor-bg)',
                color: 'var(--editor-text)',
                fontSize: 'var(--text-13)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {'　'.repeat(f.depth)}📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* 底部按钮栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isFavorited ? 'space-between' : 'flex-end',
              marginTop: 'var(--dim-6)',
              paddingTop: 'var(--dim-12)',
              borderTop: 'var(--dim-1) solid var(--editor-border)',
            }}
          >
            {isFavorited && (
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--dim-4)',
                  padding: 'var(--dim-6) var(--dim-12)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  border: 'var(--dim-1) solid var(--error-border)',
                  background: 'transparent',
                  color: 'var(--error-500)',
                  fontSize: 'var(--text-12)',
                  fontWeight: 'var(--weight-500)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error-surface)';
                  e.currentTarget.style.transform = 'scale(var(--scale-1-02))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'scale(var(--scale-1))';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(var(--scale-0-96))';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(var(--scale-1-02))';
                }}
              >
                <Trash2 size={13} />
                <span>移除收藏</span>
              </button>
            )}

            <div style={{ display: 'flex', gap: 'var(--dim-8)', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={closeAddModal}
                style={{
                  padding: 'var(--dim-6) var(--dim-14)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  border: 'var(--dim-1) solid var(--control-border)',
                  background: 'transparent',
                  color: 'var(--editor-text-secondary)',
                  fontSize: 'var(--text-13)',
                  fontWeight: 'var(--weight-500)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--toolbar-hover)';
                  e.currentTarget.style.color = 'var(--editor-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--editor-text-secondary)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(var(--scale-0-96))';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(var(--scale-1))';
                }}
              >
                取消
              </button>
              <button
                type="submit"
                style={{
                  padding: 'var(--dim-6) var(--dim-16)',
                  borderRadius: 'var(--radius-md, var(--dim-6))',
                  border: 'none',
                  background: 'var(--accent-strong)',
                  color: 'var(--nb-white)',
                  fontSize: 'var(--text-13)',
                  fontWeight: 'var(--weight-500)',
                  cursor: 'pointer',
                  boxShadow: '0 var(--dim-1) var(--dim-2) var(--nb-black-a08)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                  e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
                  e.currentTarget.style.boxShadow = '0 var(--dim-3) var(--dim-6) var(--nb-auto-3b82f6-a25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 var(--dim-1) var(--dim-2) var(--nb-black-a08)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(var(--scale-0-96))';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(calc(var(--dim-1) * -1))';
                }}
              >
                {isFavorited ? '保存' : '完成'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
