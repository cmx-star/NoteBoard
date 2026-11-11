// NoteBoard settings 命令 — IPC 接口

use crate::state::AppState;
use crate::settings::model::{self, Settings};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// 读取设置
#[tauri::command]
pub fn load_settings() -> Result<Settings, String> {
    Ok(model::load())
}

/// 保存设置（落盘 + 广播）
#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    settings: Settings,
) -> Result<u64, String> {
    let mut s = settings;

    // MCP：开启时必须持有令牌；端口 0 会让系统随机分配，无法在设置中稳定展示。
    #[cfg(desktop)]
    {
        if s.mcp.port == 0 {
            s.mcp.port = 39731;
        }
        if s.mcp.enabled && s.mcp.token.trim().is_empty() {
            s.mcp.token = uuid::Uuid::new_v4().to_string();
        }
        s.mcp.token = s.mcp.token.trim().to_string();
    }

    let revision = model::save(&mut s)?;

    // 更新 AppState revision
    {
        let mut app_state = state.lock().unwrap();
        app_state.settings_revision = revision;
    }

    // 托盘开关与全局快捷键随设置即时生效
    #[cfg(desktop)]
    crate::window::apply_system_settings(&app, &s);

    // 本地文件搜索的开关与索引位置即时生效（索引在后台线程调整，不阻塞保存）
    #[cfg(desktop)]
    crate::local_search::apply_settings(&app, &s.local_search);

    // MCP 服务随设置即时启停（端口或令牌变化时重启）
    #[cfg(desktop)]
    crate::mcp::apply_settings(&app, &s.mcp);

    // 🔴 emit 在 v2 里是广播 —— 这里是故意的（FR-1004 所有窗口同步）
    // 不需要 emit_to(label, ...)
    let _ = app.emit("nb://settings-changed", &s);

    Ok(revision)
}
