// 可视化内核的链接弹窗工厂与跨标签原生选区清理

import { useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import { emit } from '../../core/emitter';
import { useWindowStore } from '../../stores/windowStore';
import { releaseNativeSelectionWithin } from './selectionPerformance';

export function makeLinkModalOpener(docKey: string): () => void {
  return () => {
    emit('open-link-modal', { key: docKey });
  };
}

/** 切走本标签时清除落在编辑器内的原生选区：隐藏保活标签会重算整棵子树样式。 */
export function useReleaseNativeSelectionOnTabSwitch(editor: Editor | null, docKey: string) {
  useEffect(() => {
    if (!editor) return;
    return useWindowStore.subscribe((state, prev) => {
      // isDestroyed 在视图尚未挂载时同样为 true，此后访问 view.dom 是安全的
      if (prev.activeKey !== docKey || state.activeKey === docKey || editor.isDestroyed) return;
      releaseNativeSelectionWithin(editor.view.dom);
    });
  }, [docKey, editor]);
}
