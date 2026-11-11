// NoteBoard MCP 工具定义与参数校验
//
// 工具只负责描述协议形状；真正的文档操作由前端编辑器能力执行，
// 这样 Markdown 可视化/源码、代码编辑器的历史与脏态逻辑保持单一实现。

use serde_json::{json, Map, Value};

/// 当前支持的 MCP 工具名称（顺序即 tools/list 返回顺序）
pub const TOOL_NAMES: [&str; 6] = [
    "noteboard_list_documents",
    "noteboard_read_document",
    "noteboard_write_document",
    "noteboard_insert_text",
    "noteboard_replace_selection",
    "noteboard_save_document",
];

/// MCP tools/list 返回的工具描述
pub fn definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "noteboard_list_documents",
            "description": "列出 NoteBoard 当前窗口的文档标签。docKey 用于后续读取、写入或保存；supported=false 的文档类型不支持编辑。",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }),
        json!({
            "name": "noteboard_read_document",
            "description": "读取当前窗口中文档的正文。Markdown 文档返回 Markdown 文本，代码/纯文本文档返回原始文本。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "docKey": { "type": "string", "description": "noteboard_list_documents 返回的 docKey" }
                },
                "required": ["docKey"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "noteboard_write_document",
            "description": "整篇替换文档正文。Markdown 文档按 Markdown 语法解析（可新增标题、列表、表格、加粗等格式）；代码/纯文本文档按原文写入。修改进入编辑器撤销历史；本工具不主动保存（若开启了自动保存，应用可能随后落盘）。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "docKey": { "type": "string", "description": "noteboard_list_documents 返回的 docKey" },
                    "content": { "type": "string", "description": "新的完整正文" },
                    "format": {
                        "type": "string",
                        "enum": ["markdown", "text"],
                        "description": "内容格式；缺省按文档类型推断（Markdown 文档为 markdown，其他为 text）"
                    },
                    "expectedRevision": {
                        "type": "integer",
                        "minimum": 0,
                        "description": "可选：写入前的文档版本号。与当前版本不一致时拒绝写入，避免覆盖用户新输入"
                    }
                },
                "required": ["docKey", "content"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "noteboard_insert_text",
            "description": "在当前光标/选区处插入内容。Markdown 文档按 Markdown 语法解析（支持加粗、列表等格式）；代码/纯文本文档按原文插入。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "docKey": { "type": "string", "description": "noteboard_list_documents 返回的 docKey" },
                    "text": { "type": "string", "description": "要插入的内容" }
                },
                "required": ["docKey", "text"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "noteboard_replace_selection",
            "description": "用给定内容替换当前选区（无选区时等同于插入）。Markdown 文档按 Markdown 语法解析；代码/纯文本文档按原文替换。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "docKey": { "type": "string", "description": "noteboard_list_documents 返回的 docKey" },
                    "text": { "type": "string", "description": "替换后的内容" }
                },
                "required": ["docKey", "text"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "noteboard_save_document",
            "description": "保存指定文档到磁盘。写入工具不主动保存，需要落盘时请显式调用本工具。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "docKey": { "type": "string", "description": "noteboard_list_documents 返回的 docKey" }
                },
                "required": ["docKey"],
                "additionalProperties": false
            }
        }),
    ]
}

/// 是否为本服务支持的工具
pub fn is_known(name: &str) -> bool {
    TOOL_NAMES.contains(&name)
}

/// 校验工具参数的基本形状；文档级限制（类型、是否打开）由前端编辑器返回明确错误。
pub fn validate(name: &str, arguments: &Value) -> Result<(), String> {
    let object = arguments
        .as_object()
        .ok_or_else(|| "arguments 必须是 JSON 对象".to_string())?;

    match name {
        "noteboard_list_documents" => Ok(()),
        "noteboard_read_document" | "noteboard_save_document" => {
            require_string(object, "docKey")?;
            Ok(())
        }
        "noteboard_insert_text" | "noteboard_replace_selection" => {
            require_string(object, "docKey")?;
            require_string_allow_empty(object, "text")?;
            Ok(())
        }
        "noteboard_write_document" => {
            require_string(object, "docKey")?;
            require_string_allow_empty(object, "content")?;
            if let Some(format) = object.get("format") {
                match format.as_str() {
                    Some("markdown") | Some("text") => {}
                    _ => return Err("format 只能是 markdown 或 text".to_string()),
                }
            }
            if let Some(revision) = object.get("expectedRevision") {
                if revision.as_u64().is_none() {
                    return Err("expectedRevision 必须是非负整数".to_string());
                }
            }
            Ok(())
        }
        _ => Err(format!("未知工具：{name}")),
    }
}

fn require_string(object: &Map<String, Value>, key: &str) -> Result<(), String> {
    match object.get(key).and_then(Value::as_str) {
        Some(value) if !value.is_empty() => Ok(()),
        Some(_) => Err(format!("{key} 不能为空")),
        None => Err(format!("缺少必填参数：{key}")),
    }
}

fn require_string_allow_empty(object: &Map<String, Value>, key: &str) -> Result<(), String> {
    match object.get(key).and_then(Value::as_str) {
        Some(_) => Ok(()),
        None => Err(format!("缺少必填参数：{key}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn definitions_cover_every_tool_once() {
        let definitions = definitions();
        assert_eq!(definitions.len(), TOOL_NAMES.len());
        for (definition, name) in definitions.iter().zip(TOOL_NAMES) {
            assert_eq!(definition["name"], name);
            assert_eq!(definition["inputSchema"]["type"], "object");
        }
    }

    #[test]
    fn validate_accepts_expected_shapes() {
        assert!(validate("noteboard_list_documents", &json!({})).is_ok());
        assert!(validate("noteboard_read_document", &json!({ "docKey": "/tmp/a.md" })).is_ok());
        assert!(validate(
            "noteboard_write_document",
            &json!({ "docKey": "/tmp/a.md", "content": "# 标题", "format": "markdown", "expectedRevision": 3 })
        )
        .is_ok());
        assert!(validate(
            "noteboard_insert_text",
            &json!({ "docKey": "/tmp/a.md", "text": "**加粗**" })
        )
        .is_ok());
    }

    #[test]
    fn validate_rejects_missing_or_invalid_arguments() {
        assert!(validate("noteboard_read_document", &json!({})).is_err());
        assert!(validate("noteboard_read_document", &json!({ "docKey": "" })).is_err());
        assert!(validate(
            "noteboard_write_document",
            &json!({ "docKey": "/tmp/a.md", "content": "x", "format": "html" })
        )
        .is_err());
        assert!(validate(
            "noteboard_write_document",
            &json!({ "docKey": "/tmp/a.md", "content": "", "expectedRevision": -1 })
        )
        .is_err());
        assert!(validate("noteboard_unknown", &json!({})).is_err());
        assert!(validate("noteboard_list_documents", &json!([])).is_err());
        assert!(validate(
            "noteboard_write_document",
            &json!({ "docKey": "/tmp/a.md", "content": "" })
        )
        .is_ok());
        assert!(validate(
            "noteboard_replace_selection",
            &json!({ "docKey": "/tmp/a.md", "text": "" })
        )
        .is_ok());
    }
}
