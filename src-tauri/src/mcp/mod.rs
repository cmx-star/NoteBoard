// NoteBoard MCP 文档编辑服务（仅桌面端）
//
// 默认关闭；设置页开启后监听 127.0.0.1:<port>/mcp。
// Rust 侧负责 HTTP/JSON-RPC 与鉴权，实际文档读写通过 nb://mcp-request
// 交给当前聚焦窗口的前端编辑器能力执行。

mod bridge;
mod server;
mod tools;

use crate::settings::model::McpSettings;
use serde::Serialize;
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::AppHandle;

struct RunningServer {
    port: u16,
    token: String,
    generation: u64,
    shutdown: Option<tokio::sync::watch::Sender<bool>>,
}

static RUNNING: Mutex<Option<RunningServer>> = Mutex::new(None);
static NEXT_GENERATION: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
struct Status {
    generation: u64,
    running: bool,
    port: u16,
    error: Option<String>,
}

static STATUS: Mutex<Status> = Mutex::new(Status {
    generation: 0,
    running: false,
    port: 0,
    error: None,
});

/// 设置页展示的服务状态
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub port: u16,
    pub error: Option<String>,
}

/// 启动时应用设置
pub fn init(app: &AppHandle, settings: &McpSettings) {
    apply_settings(app, settings);
}

/// 设置变化时调用：关闭、重启或保持现状
pub fn apply_settings(app: &AppHandle, settings: &McpSettings) {
    let Ok(mut running) = RUNNING.lock() else {
        return;
    };

    if !settings.enabled {
        if let Some(server) = running.take() {
            stop_server(server);
        }
        update_status(|status| {
            status.running = false;
            status.port = 0;
            status.error = None;
        });
        return;
    }

    let port = settings.port;
    let token = settings.token.trim().to_string();
    if token.is_empty() {
        if let Some(server) = running.take() {
            stop_server(server);
        }
        update_status(|status| {
            status.running = false;
            status.port = port;
            status.error = Some("MCP 令牌为空，请重新保存设置以生成令牌".to_string());
        });
        return;
    }

    if let Some(server) = running.as_ref() {
        if server.port == port && server.token == token {
            // 配置未变：保留当前启动/运行状态，不把"正在绑定"误标为已运行。
            return;
        }
    }

    if let Some(server) = running.take() {
        stop_server(server);
    }

    let generation = NEXT_GENERATION.fetch_add(1, Ordering::Relaxed);
    let (shutdown, shutdown_rx) = tokio::sync::watch::channel(false);
    *running = Some(RunningServer {
        port,
        token: token.clone(),
        generation,
        shutdown: Some(shutdown),
    });
    drop(running);

    update_status(|status| {
        status.generation = generation;
        status.running = false;
        status.port = port;
        status.error = None;
    });

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match server::serve(app, port, token, generation, shutdown_rx).await {
            Ok(()) => {
                update_status_for(generation, |status| {
                    status.running = false;
                });
            }
            Err(error) => {
                eprintln!("[mcp] {error}");
                let mut guard = match RUNNING.lock() {
                    Ok(guard) => guard,
                    Err(_) => return,
                };
                if guard
                    .as_ref()
                    .is_some_and(|server| server.generation == generation)
                {
                    guard.take();
                }
                drop(guard);
                update_status_for(generation, |status| {
                    status.running = false;
                    status.error = Some(error);
                });
            }
        }
    });
}

/// 读取服务状态（设置页用于提示端口占用等错误）
#[tauri::command]
pub fn mcp_status() -> McpStatus {
    let status = match STATUS.lock() {
        Ok(status) => status,
        Err(_) => {
            return McpStatus {
                running: false,
                port: 0,
                error: Some("MCP 状态已损坏".to_string()),
            };
        }
    };
    McpStatus {
        running: status.running,
        port: status.port,
        error: status.error.clone(),
    }
}

/// 前端回包：完成一次挂起的工具调用
#[tauri::command]
pub fn mcp_respond(
    request_id: String,
    ok: bool,
    data: Option<Value>,
    error: Option<Value>,
) -> Result<(), String> {
    bridge::respond(request_id, ok, data, error)
}

/// 进程退出时停止监听
pub fn stop() {
    if let Ok(mut running) = RUNNING.lock() {
        if let Some(server) = running.take() {
            stop_server(server);
        }
    }
    update_status(|status| {
        status.running = false;
        status.error = None;
    });
}

fn stop_server(mut server: RunningServer) {
    if let Some(shutdown) = server.shutdown.take() {
        let _ = shutdown.send(true);
    }
}

fn update_status(update: impl FnOnce(&mut Status)) {
    if let Ok(mut status) = STATUS.lock() {
        update(&mut status);
    }
}

fn update_status_for(generation: u64, update: impl FnOnce(&mut Status)) {
    if let Ok(mut status) = STATUS.lock() {
        if status.generation == generation {
            update(&mut status);
        }
    }
}

/// 监听成功后由 server 模块回调，避免设置页把"正在启动"误判为已运行。
fn mark_running(generation: u64) {
    update_status_for(generation, |status| {
        status.running = true;
        status.error = None;
    });
}
