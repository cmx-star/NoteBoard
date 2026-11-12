// NoteBoard 全局错误边界（ErrorBoundary）
// 捕获子组件渲染期间的未处理异常，避免整屏无声白屏

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { getEditorCapabilities } from '../core/editor/editorRegistry';
import { saveViewState } from '../features/session/editorSuspension';
import { useWindowStore } from '../stores/windowStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 在错误界面替换应用子树前兜底捕获活动编辑器的视图状态。
 * 正文由 store/暂存链保护；这里只保存选区、滚动或画布视口，失败不得影响错误展示。
 */
export function captureActiveViewStateForRecovery(): void {
  try {
    const activeKey = useWindowStore.getState().activeKey;
    if (!activeKey) return;
    const viewState = getEditorCapabilities(activeKey)?.captureViewState?.();
    if (viewState !== undefined && viewState !== null) {
      saveViewState(activeKey, viewState);
    }
  } catch (error) {
    console.error('捕获异常恢复位置失败:', error);
  }
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureActiveViewStateForRecovery();
    console.error('ErrorBoundary 捕获到未处理的 React 渲染错误:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: 'var(--dim-32)',
            background: 'var(--editor-bg)',
            color: 'var(--editor-text)',
            fontFamily: 'var(--content-font-family, sans-serif)',
            userSelect: 'text',
          }}
        >
          <div style={{ fontSize: 'var(--text-18)', fontWeight: 'var(--weight-600)', marginBottom: 'var(--dim-8)', color: 'var(--nb-red-600)' }}>
            界面渲染异常
          </div>
          <div
            style={{
              fontSize: 'var(--text-13)',
              color: 'var(--editor-text-secondary)',
              marginBottom: 'var(--dim-16)',
              maxWidth: 'var(--dim-600)',
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error?.message || '未知错误'}
          </div>
          <button
            type="button"
            className="nb-btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: 'var(--dim-8) var(--dim-20)',
              fontSize: 'var(--text-13)',
            }}
          >
            恢复并重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
