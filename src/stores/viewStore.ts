// NoteBoard 视图 Store
// 只放纯前端、不落盘的当前窗口视图状态。

import { create } from 'zustand';
import { useWindowStore, type Tab } from './windowStore';

interface ViewStore {
  /** 结构化视图面板是否打开 */
  structuredViewOpen: boolean;
  /** 面板绑定的文档；切换文档后只在支持的类型上重新显示 */
  structuredViewDocKey: string | null;
  toggleStructuredView: () => void;
  closeStructuredView: () => void;
}

/** 当前文档是否支持结构化视图（首版只支持 JSON 类文档） */
export function supportsStructuredView(tab: Pick<Tab, 'kind' | 'language'> | null | undefined): boolean {
  return Boolean(tab && tab.kind === 'code' && tab.language === 'json');
}

export const useViewStore = create<ViewStore>((set, get) => ({
  structuredViewOpen: false,
  structuredViewDocKey: null,

  toggleStructuredView: () => {
    // activeTab 是 store 上的方法，返回当前活动标签
    const { activeKey, activeTab } = useWindowStore.getState();
    const tab = activeTab();
    if (!activeKey || !supportsStructuredView(tab)) {
      set({ structuredViewOpen: false, structuredViewDocKey: null });
      return;
    }
    const open = get().structuredViewDocKey === activeKey ? !get().structuredViewOpen : true;
    set({
      structuredViewOpen: open,
      structuredViewDocKey: open ? activeKey : null,
    });
  },

  closeStructuredView: () => set({ structuredViewOpen: false, structuredViewDocKey: null }),
}));
