// 应用外壳全局快捷键：保存、查找替换、标签切换、历史记录与中文排版格式化等
import { useEffect } from 'react';
import { useWindowStore } from '../../stores/windowStore';
import { useSearchStore } from '../../stores/searchStore';
import { getEditorCapabilities } from '../../core/editor/editorRegistry';
import { registerShortcut } from '../../core/shortcuts';
import { emit } from '../../core/emitter';
import { saveDocument } from '../../features/editor-code/orchestration/saveDocument';
import { runCjkFormatWithToast } from '../../features/cjkFormat/applyCjkFormat';
import { openVersionHistory, useVersionHistoryStore } from '../../features/versionHistory/versionHistoryStore';
import { isDocumentReading } from '../../features/reading/readingMode';

export function useAppShellShortcuts() {
  useEffect(() => {
    const unregCtrlS = registerShortcut({
      key: 'Ctrl+S',
      action: () => {
        const cur = useWindowStore.getState().activeKey;
        if (cur) {
          saveDocument(cur);
        }
      },
      scope: 'global',
      description: '保存当前文档',
    });

    // Ctrl+F 查找
    const unregCtrlF = registerShortcut({
      key: 'Ctrl+F',
      action: () => {
        const currentTab = useWindowStore.getState().activeTab();
        if (!currentTab) return;
        // 选中文本经能力注册表按当前模式获取（code / markdown visual / markdown source）
        const capabilities = getEditorCapabilities(currentTab.key);
        // 画板/思维导图/表格等无文本搜索能力的编辑器不打开搜索栏（打开也永远 0 匹配）
        if (!capabilities?.search) return;
        const selected = capabilities.getSelectedText();
        const searchStore = useSearchStore.getState();
        searchStore.openSearch(selected.trim() ? selected : undefined, 'search');
      },
      scope: 'global',
      description: '查找文本',
    });

    // Ctrl+H / Ctrl+R 替换（Mac 上 Cmd+H 被系统「隐藏应用」占用，Cmd+R 作为主要入口）
    const openReplace = () => {
      const currentTab = useWindowStore.getState().activeTab();
      if (!currentTab) return;
      const capabilities = getEditorCapabilities(currentTab.key);
      // 画板/思维导图/表格等无文本搜索能力的编辑器不打开搜索栏（打开也永远 0 匹配）
      if (!capabilities?.search) return;
      const selected = capabilities.getSelectedText();
      const searchStore = useSearchStore.getState();
      searchStore.openSearch(selected.trim() ? selected : undefined, 'replace');
    };
    const unregCtrlH = registerShortcut({
      key: 'Ctrl+H',
      action: openReplace,
      scope: 'global',
      description: '替换文本',
    });
    const unregCtrlR = registerShortcut({
      key: 'Ctrl+R',
      action: openReplace,
      scope: 'global',
      description: '替换文本',
    });

    // Ctrl+W 关闭当前标签页
    const unregCtrlW = registerShortcut({
      key: 'Ctrl+W',
      action: () => {
        const curKey = useWindowStore.getState().activeKey;
        if (curKey) {
          useWindowStore.getState().requestCloseTab(curKey);
        }
      },
      scope: 'global',
      description: '关闭当前标签页',
    });

    // Ctrl+/ 切换 Markdown 可视化 / 源码模式：全局只注册一次，按活动标签分发
    // （非 Markdown 标签没有该事件的监听者，按下无副作用）
    const unregToggleMdMode = registerShortcut({
      key: 'Ctrl+/',
      action: () => {
        const curKey = useWindowStore.getState().activeKey;
        if (curKey) {
          emit('toggle-md-view-mode', { key: curKey });
        }
      },
      scope: 'global',
      description: '切换 Markdown 可视化 / 源码模式',
    });

    // ── JSON 快捷操作（支持 .json / .txt / 源码模式等） ──

    // 1. JSON 展开 / 格式化 (Shift+Alt+F / Ctrl+Alt+L)
    const handleExpandAction = () => {
      const currentTab = useWindowStore.getState().activeTab();
      if (!currentTab) return;
      // code 与 markdown 源码模式均通过能力注册表分发；能力内部按当前模式判断可用性
      // 沉浸阅读只读：不改写正文
      if (isDocumentReading(currentTab.key)) return;
      getEditorCapabilities(currentTab.key)?.codeOps?.expandJson();
    };

    const unregExpandShiftAltF = registerShortcut({
      key: 'Shift+Alt+F',
      action: handleExpandAction,
      scope: 'global',
      description: 'JSON 展开 / 格式化',
    });

    const unregExpandCtrlAltL = registerShortcut({
      key: 'Ctrl+Alt+L',
      action: handleExpandAction,
      scope: 'global',
      description: 'JSON 展开 / 格式化 (JetBrains)',
    });

    // 2. JSON 压缩 (Shift+Alt+M / Ctrl+Alt+M)
    const handleMinifyAction = () => {
      const currentTab = useWindowStore.getState().activeTab();
      if (!currentTab) return;
      // 沉浸阅读只读：不改写正文
      if (isDocumentReading(currentTab.key)) return;
      getEditorCapabilities(currentTab.key)?.codeOps?.minifyJson();
    };

    const unregMinifyShiftAltM = registerShortcut({
      key: 'Shift+Alt+M',
      action: handleMinifyAction,
      scope: 'global',
      description: 'JSON 压缩为单行',
    });

    const unregMinifyCtrlAltM = registerShortcut({
      key: 'Ctrl+Alt+M',
      action: handleMinifyAction,
      scope: 'global',
      description: 'JSON 压缩为单行',
    });

    // 3. JSON 格式校验 (Shift+Alt+V / Ctrl+Alt+V)
    const handleValidateAction = () => {
      const currentTab = useWindowStore.getState().activeTab();
      if (!currentTab) return;
      getEditorCapabilities(currentTab.key)?.codeOps?.validateJson();
    };

    const unregValidateShiftAltV = registerShortcut({
      key: 'Shift+Alt+V',
      action: handleValidateAction,
      scope: 'global',
      description: 'JSON 格式校验',
    });

    const unregValidateCtrlAltV = registerShortcut({
      key: 'Ctrl+Alt+V',
      action: handleValidateAction,
      scope: 'global',
      description: 'JSON 格式校验',
    });

    // Ctrl+Alt+Z 查看当前文档的历史记录
    const unregHistory = registerShortcut({
      key: 'Ctrl+Alt+Z',
      action: () => {
        const history = useVersionHistoryStore.getState();
        if (history.open) history.close();
        else openVersionHistory();
      },
      scope: 'global',
      description: '历史记录',
    });

    // Ctrl+Alt+F 中文排版格式化（选区优先，无选区处理全文）
    const unregCjkFormat = registerShortcut({
      key: 'Ctrl+Alt+F',
      action: () => {
        void runCjkFormatWithToast();
      },
      scope: 'global',
      description: '格式化中文排版',
    });

    return () => {
      unregCjkFormat();
      unregHistory();
      unregCtrlS();
      unregCtrlF();
      unregCtrlH();
      unregCtrlR();
      unregCtrlW();
      unregToggleMdMode();
      unregExpandShiftAltF();
      unregExpandCtrlAltL();
      unregMinifyShiftAltM();
      unregMinifyCtrlAltM();
      unregValidateShiftAltV();
      unregValidateCtrlAltV();
    };
  // 所有 action 都在触发时读取 store 中的活动标签，无需随文件切换反复注销和注册。
  }, []);
}
