// NoteBoard MCP Streamable HTTP 服务
//
// 只监听 127.0.0.1，使用无状态 JSON 响应：
//   POST /mcp  → 单条或批量 JSON-RPC 请求
//   通知（notifications/*）→ 202 Accepted，无响应体
// GET/DELETE 不提供 SSE 会话，返回 405。
//
// 鉴权：Authorization: Bearer <settings.mcp.token>。

use super::{bridge, tools};
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::Router;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::watch;

struct ServerState {
    app: AppHandle,
    token: String,
}

/// 启动 HTTP 服务，直到收到停止信号。
pub async fn serve(
    app: AppHandle,
    port: u16,
    token: String,
    generation: u64,
    mut shutdown: watch::Receiver<bool>,
) -> Result<(), String> {
    // 端口切换/令牌变更重启时，旧监听可能尚未完全释放；短暂重试避免误报占用。
    let mut last_error = String::new();
    let mut listener = None;
    for _ in 0..30 {
        match tokio::net::TcpListener::bind(("127.0.0.1", port)).await {
            Ok(bound) => {
                listener = Some(bound);
                break;
            }
            Err(error) => {
                last_error = error.to_string();
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }
    let listener = listener.ok_or_else(|| format!("无法监听 127.0.0.1:{port}：{last_error}"))?;
    // 绑定成功后才对外宣称运行中，端口占用等错误由调用方写入设置页状态。
    super::mark_running(generation);

    let state = Arc::new(ServerState { app, token });
    let router = Router::new()
        .route(
            "/mcp",
            post(handle_mcp)
                .get(method_not_allowed)
                .delete(method_not_allowed),
        )
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .with_state(state);

    axum::serve(listener, router)
        .with_graceful_shutdown(async move {
            let _ = shutdown.changed().await;
        })
        .await
        .map_err(|error| format!("MCP 服务异常退出：{error}"))
}

async fn method_not_allowed() -> Response {
    StatusCode::METHOD_NOT_ALLOWED.into_response()
}

async fn handle_mcp(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if !origin_allowed(&headers) {
        return (StatusCode::FORBIDDEN, "Origin not allowed").into_response();
    }
    if !authorized(&headers, &state.token) {
        return (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
            "Unauthorized",
        )
            .into_response();
    }

    let message: Value = match serde_json::from_slice(&body) {
        Ok(value) => value,
        Err(error) => {
            return json_response(
                StatusCode::BAD_REQUEST,
                rpc_error(Value::Null, -32700, format!("JSON 解析失败：{error}")),
            );
        }
    };

    match message {
        Value::Array(items) => {
            if items.is_empty() {
                return json_response(
                    StatusCode::BAD_REQUEST,
                    rpc_error(Value::Null, -32600, "批量请求不能为空"),
                );
            }
            let mut responses = Vec::new();
            for item in items {
                if let Some(response) = handle_message(&state, item).await {
                    responses.push(response);
                }
            }
            if responses.is_empty() {
                StatusCode::ACCEPTED.into_response()
            } else {
                json_response(StatusCode::OK, Value::Array(responses))
            }
        }
        single => match handle_message(&state, single).await {
            Some(response) => json_response(StatusCode::OK, response),
            None => StatusCode::ACCEPTED.into_response(),
        },
    }
}

async fn handle_message(state: &ServerState, message: Value) -> Option<Value> {
    let Some(object) = message.as_object() else {
        return Some(rpc_error(Value::Null, -32600, "请求必须是 JSON 对象"));
    };
    let Some(id) = object.get("id").cloned() else {
        // 通知没有 id，不需要响应；initialized/cancelled 均无需额外状态。
        return None;
    };
    if object.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Some(rpc_error(id, -32600, "jsonrpc 必须为 2.0"));
    }
    let Some(method) = object.get("method").and_then(Value::as_str) else {
        return Some(rpc_error(id, -32600, "缺少 method"));
    };
    let params = object.get("params").cloned().unwrap_or_else(|| json!({}));

    match method {
        "initialize" => {
            let protocol_version = negotiate_protocol_version(&params);
            Some(rpc_result(
                id,
                json!({
                    "protocolVersion": protocol_version,
                    "capabilities": { "tools": { "listChanged": false } },
                    "serverInfo": {
                        "name": "noteboard",
                        "title": "Loomark 文档编辑",
                        "version": env!("CARGO_PKG_VERSION")
                    },
                    "instructions": "操作 Loomark 当前窗口中的 Markdown 与代码/纯文本文档。先用 noteboard_list_documents 获取 docKey；写入工具本身不主动保存，需要落盘时调用 noteboard_save_document。"
                }),
            ))
        }
        "ping" => Some(rpc_result(id, json!({}))),
        "tools/list" => Some(rpc_result(id, json!({ "tools": tools::definitions() }))),
        "tools/call" => Some(call_tool(state, id, params).await),
        _ => Some(rpc_error(id, -32601, format!("不支持的方法：{method}"))),
    }
}

async fn call_tool(state: &ServerState, id: Value, params: Value) -> Value {
    let Some(name) = params.get("name").and_then(Value::as_str) else {
        return rpc_error(id, -32602, "tools/call 缺少工具名称");
    };
    if !tools::is_known(name) {
        return rpc_error(id, -32602, format!("未知工具：{name}"));
    }
    let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
    if let Err(message) = tools::validate(name, &arguments) {
        return rpc_error(id, -32602, message);
    }

    let result = bridge::request(&state.app, name, arguments).await;
    let tool_result = match result {
        Ok(data) => json!({
            "content": [{ "type": "text", "text": pretty_json(&data) }],
            "isError": false
        }),
        Err(message) => json!({
            "content": [{ "type": "text", "text": message }],
            "isError": true
        }),
    };
    rpc_result(id, tool_result)
}

fn pretty_json(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

fn negotiate_protocol_version(params: &Value) -> &'static str {
    match params.get("protocolVersion").and_then(Value::as_str) {
        Some("2024-11-05") => "2024-11-05",
        Some("2025-03-26") => "2025-03-26",
        Some("2025-06-18") => "2025-06-18",
        _ => "2025-06-18",
    }
}

fn rpc_result(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn rpc_error(id: Value, code: i64, message: impl Into<String>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message.into() }
    })
}

fn json_response(status: StatusCode, value: Value) -> Response {
    (
        status,
        [(header::CONTENT_TYPE, "application/json")],
        value.to_string(),
    )
        .into_response()
}

fn authorized(headers: &HeaderMap, expected: &str) -> bool {
    bearer_token(headers).is_some_and(|provided| token_matches(provided, expected))
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("Bearer") {
        return None;
    }
    Some(token.trim())
}

/// 固定长度逐字节比较，避免在错误令牌上产生明显的时间差。
fn token_matches(provided: &str, expected: &str) -> bool {
    let provided = provided.as_bytes();
    let expected = expected.as_bytes();
    if provided.len() != expected.len() || expected.is_empty() {
        return false;
    }
    let mut difference = 0u8;
    for (left, right) in provided.iter().zip(expected) {
        difference |= left ^ right;
    }
    difference == 0
}

/// 允许无 Origin 的原生客户端，以及本机/ Tauri 页面来源，阻止 DNS rebinding。
fn origin_allowed(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(header::ORIGIN).and_then(|value| value.to_str().ok()) else {
        return true;
    };
    let origin = origin.to_ascii_lowercase();
    origin == "tauri://localhost"
        || origin == "http://tauri.localhost"
        || origin == "https://tauri.localhost"
        || origin == "http://127.0.0.1"
        || origin.starts_with("http://127.0.0.1:")
        || origin == "http://localhost"
        || origin.starts_with("http://localhost:")
        || origin == "http://[::1]"
        || origin.starts_with("http://[::1]:")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(authorization: Option<&str>, origin: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Some(value) = authorization {
            headers.insert(header::AUTHORIZATION, value.parse().unwrap());
        }
        if let Some(value) = origin {
            headers.insert(header::ORIGIN, value.parse().unwrap());
        }
        headers
    }

    #[test]
    fn bearer_authentication_is_exact() {
        let expected = "test-token";
        assert!(authorized(&headers(Some("Bearer test-token"), None), expected));
        assert!(authorized(&headers(Some("bearer test-token"), None), expected));
        assert!(!authorized(&headers(Some("Bearer wrong"), None), expected));
        assert!(!authorized(&headers(Some("Basic test-token"), None), expected));
        assert!(!authorized(&headers(None, None), expected));
        assert!(!token_matches("", ""));
    }

    #[test]
    fn origin_allows_only_local_sources() {
        assert!(origin_allowed(&headers(None, None)));
        assert!(origin_allowed(&headers(None, Some("tauri://localhost"))));
        assert!(origin_allowed(&headers(None, Some("http://127.0.0.1:1420"))));
        assert!(origin_allowed(&headers(None, Some("http://localhost:39731"))));
        assert!(!origin_allowed(&headers(None, Some("https://example.com"))));
        assert!(!origin_allowed(&headers(None, Some("http://192.168.1.10:39731"))));
    }

    #[test]
    fn protocol_version_is_negotiated() {
        assert_eq!(negotiate_protocol_version(&json!({})), "2025-06-18");
        assert_eq!(
            negotiate_protocol_version(&json!({ "protocolVersion": "2024-11-05" })),
            "2024-11-05"
        );
        assert_eq!(
            negotiate_protocol_version(&json!({ "protocolVersion": "unknown" })),
            "2025-06-18"
        );
    }
}
