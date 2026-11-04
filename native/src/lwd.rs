use std::fs;
use std::io::Write;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

use chrono::{SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::model::{document_to_json, parse_document, Document};

#[derive(Clone, Debug)]
pub struct LoadedLwd {
    pub document: Document,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
struct LwdEnvelope {
    format: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    meta: Value,
    document: Value,
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn read_lwd(path: &Path) -> Result<LoadedLwd, String> {
    let raw = fs::read_to_string(path).map_err(|error| format!("读取失败：{error}"))?;
    let fallback = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("未命名文档");
    parse_lwd(&raw, fallback)
}

pub fn read_lwd_bytes(bytes: &[u8], fallback_title: &str) -> Result<LoadedLwd, String> {
    let raw = std::str::from_utf8(bytes).map_err(|error| format!("文档不是 UTF-8：{error}"))?;
    parse_lwd(raw, fallback_title)
}

fn parse_lwd(raw: &str, fallback_title: &str) -> Result<LoadedLwd, String> {
    let raw = raw.strip_prefix('\u{feff}').unwrap_or(raw);
    let envelope: LwdEnvelope =
        serde_json::from_str(raw).map_err(|error| format!("不是有效的 .lwd：{error}"))?;
    if envelope.format != "lwd" {
        return Err("不是轻文 .lwd 文档".to_string());
    }
    let document_json = json!({
        "document": envelope.document,
        "meta": envelope.meta,
    });
    let document = parse_document(&document_json);
    let title = envelope
        .meta
        .get("title")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_title)
        .to_string();
    Ok(LoadedLwd {
        document,
        title,
        created_at: envelope.created_at,
        updated_at: envelope.updated_at,
    })
}

pub fn content_hash(document: &Document, title: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    title.hash(&mut hasher);
    document_to_json(&document).to_string().hash(&mut hasher);
    serde_json::to_string(&document.layout)
        .unwrap_or_default()
        .hash(&mut hasher);
    hasher.finish()
}

pub fn serialize_lwd(
    document: &Document,
    title: &str,
    created_at: &str,
) -> Result<(Vec<u8>, String), String> {
    let updated_at = now_iso();
    let document = crate::model::merged_for_save(document);
    let layout = serde_json::to_value(&document.layout)
        .map_err(|error| format!("序列化版式失败：{error}"))?;
    let meta = json!({
        "title": title,
        "wordCount": document.word_count(),
        "characterCount": document.character_count(),
        "layout": layout,
    });
    let envelope = json!({
        "format": "lwd",
        "version": 1,
        "app": "qingwen-native",
        "createdAt": created_at,
        "updatedAt": updated_at,
        "meta": meta,
        "document": document_to_json(&document),
    });
    let bytes = serde_json::to_vec_pretty(&envelope)
        .map_err(|error| format!("序列化文档失败：{error}"))?;
    Ok((bytes, updated_at))
}

pub fn save_lwd(
    path: &Path,
    document: &Document,
    title: &str,
    created_at: &str,
) -> Result<String, String> {
    let (bytes, updated_at) = serialize_lwd(document, title, created_at)?;
    atomic_write(path, &bytes)?;
    Ok(updated_at)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建目录失败：{error}"))?;
    }
    let temporary = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("lwd")
    ));
    {
        let mut file =
            fs::File::create(&temporary).map_err(|error| format!("创建临时文件失败：{error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("写入临时文件失败：{error}"))?;
        file.sync_all()
            .map_err(|error| format!("同步临时文件失败：{error}"))?;
    }
    if path.exists() {
        let _ = fs::remove_file(path);
    }
    fs::rename(&temporary, path).map_err(|error| format!("替换文件失败：{error}"))?;
    Ok(())
}

pub fn title_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("未命名文档")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Block, BlockKind, Document, PageLayout, TableCell, TableData};

    #[test]
    fn native_lwd_roundtrip() {
        let folder = std::env::temp_dir().join(format!(
            "qingwen-native-test-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&folder).unwrap();
        let path = folder.join("原生测试.lwd");
        let mut document = Document::blank(PageLayout::default());
        document
            .blocks
            .push(Block::new(1, BlockKind::Paragraph, "第一段".into()));
        let mut heading = Block::new(2, BlockKind::Heading(1), "标题".into());
        heading.marks.push(crate::model::MarkRange {
            start: 0,
            end: "标题".len(),
            marks: crate::model::Marks {
                bold: true,
                ..Default::default()
            },
        });
        document.blocks.push(heading);
        let created = now_iso();
        let updated = save_lwd(&path, &document, "原生测试", &created).unwrap();
        assert!(!updated.is_empty());
        let loaded = read_lwd(&path).unwrap();
        assert_eq!(loaded.title, "原生测试");
        assert_eq!(loaded.document.character_count(), 5);
        assert_eq!(loaded.document.blocks.len(), 2);
        assert_eq!(loaded.document.blocks[1].text, "标题");
        assert!(loaded.document.blocks[1].marks[0].marks.bold);

        let mut table_document = Document::blank(PageLayout::default());
        table_document.blocks.push(Block {
            id: 1,
            kind: BlockKind::Table,
            text: String::new(),
            marks: Vec::new(),
            raw: None,
            continuation: false,
            chunked: false,
            table: Some(TableData {
                header: true,
                rows: vec![
                    vec![TableCell { text: "姓名".into() }, TableCell { text: "年龄".into() }],
                    vec![TableCell { text: "轻文".into() }, TableCell { text: "1".into() }],
                ],
            }),
            align: crate::model::TextAlign::Left,
        });
        let table_path = folder.join("表格.lwd");
        save_lwd(&table_path, &table_document, "表格", &created).unwrap();
        let loaded_table = read_lwd(&table_path).unwrap();
        let table = loaded_table.document.blocks[0].table.as_ref().unwrap();
        assert!(table.header);
        assert_eq!(table.rows[1][0].text, "轻文");
        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn continuation_chunks_merge_when_saved() {
        let folder = std::env::temp_dir().join("qingwen-native-continuation");
        fs::create_dir_all(&folder).unwrap();
        let path = folder.join("continuation.lwd");
        let created = "2026-01-01T00:00:00Z".to_string();
        let mut document = Document::blank(PageLayout::default());
        document
            .blocks
            .push(Block::new(1, BlockKind::Paragraph, "前半段。".into()));
        let mut continuation = Block::new(2, BlockKind::Paragraph, "后半段。".into());
        continuation.continuation = true;
        document.blocks.push(continuation);
        save_lwd(&path, &document, "续段测试", &created).unwrap();
        let loaded = read_lwd(&path).unwrap();
        assert_eq!(loaded.document.blocks.len(), 1);
        assert_eq!(loaded.document.blocks[0].text, "前半段。后半段。");
        let _ = fs::remove_file(path);
    }
}
