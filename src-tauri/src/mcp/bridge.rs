// NoteBoard MCP ↔ 前端编辑器桥
//
// MCP 工具调用最终需要读写 WebView 中的编辑器状态，Rust 侧只负责：
//   1. 选出目标窗口（优先当前聚焦窗口）
//   2. 为每次调用生成 requestId 并等待前端 mcp_respond 回包
//   3. 超时后清理挂起请求，避免泄漏

use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

/// 前端回包负载
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeReply {
    pub ok: bool,
    pub data: Option<Value>,
    pub error: Option<Value>,
}

/// requestId → 等待中的调用
static PENDING: OnceLock<Mutex<HashMap<String, oneshot::Sender<BridgeReply>>>> = OnceLock::new();

fn pending() -> &'static Mutex<HashMap<String, oneshot::Sender<BridgeReply>>> {
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 选择目标窗口：聚焦窗口优先；没有聚焦时退回主窗口，再退回任意窗口。
fn target_window(app: &AppHandle) -> Result<String, String> {
    let windows = app.webview_windows();
    if windows.is_empty() {
        return Err("没有已打开的 NoteBoard 窗口".to_string());
    }
    for (label, window) in &windows {
        if window.is_focused().unwrap_or(false) {
            return Ok(label.clone());
        }
    }
    if windows.contains_key("nb-main") {
        return Ok("nb-main".to_string());
    }
    windows
        .keys()
        .next()
        .cloned()
        .ok_or_else(|| "没有已打开的 NoteBoard 窗口".to_string())
}

/// 向前端发送一次工具调用并等待回包。
pub async fn request(app: &AppHandle, tool: &str, arguments: Value) -> Result<Value, String> {
    let label = target_window(app)?;
    let request_id = uuid::Uuid::new_v4().to_string();
    let (sender, receiver) = oneshot::channel();
    pending()
        .lock()
        .map_err(|_| "MCP 请求表已损坏".to_string())?
        .insert(request_id.clone(), sender);

    let payload = json!({
        "requestId": request_id,
        "tool": tool,
        "arguments": arguments,
        "windowLabel": label,
    });
    if let Err(error) = app.emit_to(&label, "nb://mcp-request", payload) {
        if let Ok(mut pending_requests) = pending().lock() {
            pending_requests.remove(&request_id);
        }
        return Err(format!("无法通知编辑窗口：{error}"));
    }

    let result = tokio::time::timeout(Duration::from_secs(30), receiver).await;
    if let Ok(mut pending_requests) = pending().lock() {
        pending_requests.remove(&request_id);
    }

    match result {
        Ok(Ok(reply)) if reply.ok => Ok(reply.data.unwrap_or(Value::Null)),
        Ok(Ok(reply)) => Err(format_bridge_error(reply.error)),
        Ok(Err(_)) => Err("编辑窗口未返回结果（可能已关闭或正在重载）".to_string()),
        Err(_) => Err("操作超时（30 秒）：请确认 NoteBoard 窗口已打开且编辑器完成加载".to_string()),
    }
}

/// 前端回包：把结果交给等待中的工具调用。
pub fn respond(request_id: String, ok: bool, data: Option<Value>, error: Option<Value>) -> Result<(), String> {
    let sender = pending()
        .lock()
        .map_err(|_| "MCP 请求表已损坏".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "未知或已超时的 MCP 请求".to_string())?;
    sender
        .send(BridgeReply { ok, data, error })
        .map_err(|_| "MCP 请求已结束".to_string())
}

fn format_bridge_error(error: Option<Value>) -> String {
    let Some(error) = error else {
        return "编辑器返回失败，但未提供原因".to_string();
    };
    if let Some(message) = error.get("message").and_then(Value::as_str) {
        let code = error.get("code").and_then(Value::as_str).unwrap_or("error");
        return format!("{message}（{code}）");
    }
    match error {
        Value::String(message) => message,
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_structured_error() {
        let message = format_bridge_error(Some(json!({
            "code": "unsupported_document",
            "message": "画板不支持 MCP 编辑"
        })));
        assert_eq!(message, "画板不支持 MCP 编辑（unsupported_document）");
    }

    #[test]
    fn formats_missing_and_plain_errors() {
        assert_eq!(format_bridge_error(None), "编辑器返回失败，但未提供原因");
        assert_eq!(format_bridge_error(Some(json!("失败"))), "失败");
    }
}
