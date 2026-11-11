// NoteBoard 设置 → 全局：MCP 文档编辑服务
// 默认关闭，仅监听 127.0.0.1；令牌可复制给 Codex/Claude 等 MCP 客户端。

import { useCallback, useEffect, useState } from 'react';
import { Bot, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import * as ipc from '../../core/ipc/commands';
import type { McpStatus } from '../../core/ipc/types';
import { useMcpSettings, useSettingsStore } from '../../stores/settingsStore';
import { showToast } from '../../stores/toastStore';

const DEFAULT_PORT = 39731;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

/** 生成新的随机令牌（uuid v4 优先，环境不支持时退回随机十六进制） */
function createToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label}已复制`, 'success');
  } catch {
    showToast(`复制${label}失败`, 'error');
  }
}

export function McpSettingsCard() {
  const { enabled, port, token } = useMcpSettings();
  const setMcp = useSettingsStore((state) => state.setMcp);
  const [portDraft, setPortDraft] = useState(String(port));
  const [status, setStatus] = useState<McpStatus | null>(null);

  useEffect(() => {
    setPortDraft(String(port));
  }, [port]);

  // 开启后短轮询几次：端口占用等错误由 Rust 异步绑定后写入状态。
  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      return;
    }
    setStatus(null);
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const next = await ipc.mcpStatus();
        if (cancelled) return;
        setStatus(next);
        if (!next.running && !next.error && attempts < 10) {
          setTimeout(() => void tick(), 500);
        }
      } catch {
        if (!cancelled) setStatus(null);
      }
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [enabled, port, token]);

  const handleToggle = async (on: boolean) => {
    const nextToken = on && !token ? createToken() : token;
    await setMcp({ enabled: on, token: nextToken });
  };

  const commitPort = async () => {
    const value = Number(portDraft);
    if (!Number.isInteger(value) || value < MIN_PORT || value > MAX_PORT) {
      showToast(`端口需为 ${MIN_PORT}–${MAX_PORT} 的整数`, 'warning');
      setPortDraft(String(port));
      return;
    }
    if (value !== port) await setMcp({ port: value });
  };

  const endpoint = `http://127.0.0.1:${port}/mcp`;
  const configExample = JSON.stringify(
    {
      mcpServers: {
        noteboard: {
          type: 'http',
          url: endpoint,
          headers: { Authorization: `Bearer ${token || '<token>'}` },
        },
      },
    },
    null,
    2,
  );

  const statusText = !enabled
    ? '未开启'
    : status?.error
      ? status.error
      : status?.running
        ? `运行中 · 127.0.0.1:${port}`
        : '正在启动…';
  const statusColor = status?.error
    ? 'var(--danger, #dc2626)'
    : status?.running && enabled
      ? 'var(--success, #16a34a)'
      : 'var(--editor-text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px', background: 'var(--editor-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--editor-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
            <Bot size={15} color="var(--accent-strong)" />
            <span>MCP 文档编辑</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--editor-text-muted)', marginTop: 4 }}>
            允许本机 AI 客户端读取并修改 Markdown、代码与纯文本文档；仅监听 127.0.0.1
          </div>
        </div>
        <input
          type="checkbox"
          aria-label="MCP 文档编辑"
          checked={enabled}
          onChange={(event) => void handleToggle(event.target.checked)}
        />
      </div>

      {enabled && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: statusColor }}>
            <ShieldCheck size={14} />
            <span>{statusText}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>监听端口</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={portDraft}
                inputMode="numeric"
                aria-label="MCP 监听端口"
                onChange={(event) => setPortDraft(event.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => void commitPort()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitPort();
                  }
                }}
                style={{ width: 110, padding: '6px 8px', fontSize: 12.5, background: 'var(--editor-bg)', color: 'var(--editor-text)', border: '1px solid var(--editor-border)', borderRadius: 6 }}
              />
              <button
                type="button"
                className="nb-btn-secondary"
                onClick={() => {
                  setPortDraft(String(DEFAULT_PORT));
                  if (port !== DEFAULT_PORT) void setMcp({ port: DEFAULT_PORT });
                }}
                style={{ fontSize: 12 }}
              >
                恢复默认
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>访问令牌</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, padding: '6px 8px', background: 'var(--editor-bg)', border: '1px solid var(--editor-border)', borderRadius: 6 }}>
                {token || '尚未生成'}
              </code>
              <button
                type="button"
                className="nb-btn-secondary"
                title="复制令牌"
                disabled={!token}
                onClick={() => void copyText(token, '令牌')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                <Copy size={13} />
                复制
              </button>
              <button
                type="button"
                className="nb-btn-secondary"
                title="重新生成令牌（已连接的客户端需要更新配置）"
                onClick={() => void setMcp({ token: createToken() })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                <RefreshCw size={13} />
                重新生成
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--editor-text-muted)' }}>
              令牌等同编辑权限，请勿分享；重新生成后，已连接的客户端需同步更新配置。
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>客户端配置示例</div>
              <button
                type="button"
                className="nb-btn-secondary"
                onClick={() => void copyText(configExample, '配置示例')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                <Copy size={13} />
                复制
              </button>
            </div>
            <pre style={{ margin: 0, padding: '10px 12px', overflowX: 'auto', fontSize: 11, lineHeight: 1.5, background: 'var(--editor-bg)', border: '1px solid var(--editor-border)', borderRadius: 6 }}>
              {configExample}
            </pre>
            <div style={{ fontSize: 11, color: 'var(--editor-text-muted)' }}>
              地址：{endpoint}；请求头：Authorization: Bearer &lt;令牌&gt;
            </div>
          </div>
        </>
      )}
    </div>
  );
}
