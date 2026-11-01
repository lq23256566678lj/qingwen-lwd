//! .lwd 文档、自动保存草稿、图片导入与导出的持久化实现。
//!
//! 这一层刻意不依赖前端：所有磁盘写入都经过校验、大小限制与原子替换，
//! 即使前端传入异常路径或损坏内容，也不会产生“写了一半”的文档。

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

/// .lwd 文件中的 format 标识。
pub const FORMAT_NAME: &str = "lwd";
/// 当前实现支持的最高 .lwd 版本。
pub const FORMAT_VERSION: u32 = 1;
/// 写入文件的 app 标识，仅作诊断用途。
pub const APP_NAME: &str = "qingwen-lwd";
const DRAFT_FORMAT_NAME: &str = "lwd-draft";
const MAX_DOCUMENT_BYTES: u64 = 128 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 12 * 1024 * 1024;
const MAX_EXPORT_BYTES: usize = 64 * 1024 * 1024;
const MAX_TITLE_CHARS: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocMeta {
    pub title: String,
    #[serde(default)]
    pub word_count: u64,
    #[serde(default)]
    pub character_count: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDocument {
    pub path: String,
    pub document: Value,
    pub meta: DocMeta,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedDocument {
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub bytes: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftPayload {
    pub saved_at: String,
    pub file_path: Option<String>,
    pub title: String,
    pub created_at: String,
    pub meta: DocMeta,
    pub document: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedImage {
    pub data_url: String,
    pub name: String,
    pub mime: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LwdFile {
    format: String,
    version: u32,
    app: String,
    created_at: String,
    updated_at: String,
    meta: DocMeta,
    document: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DraftFile {
    format: String,
    version: u32,
    saved_at: String,
    file_path: Option<String>,
    title: String,
    created_at: String,
    meta: DocMeta,
    document: Value,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn normalize_title(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        "无标题".to_string()
    } else {
        trimmed.chars().take(MAX_TITLE_CHARS).collect()
    }
}

fn require_absolute(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("文件路径为空".to_string());
    }
    if !path.is_absolute() {
        return Err("文件路径必须是绝对路径".to_string());
    }
    Ok(())
}

/// 只允许目标扩展名；没有扩展名时自动补全，扩展名不符时拒绝写入。
fn ensure_extension(path: &Path, extensions: &[&str]) -> Result<PathBuf, String> {
    match path.extension().and_then(|value| value.to_str()) {
        Some(existing)
            if extensions
                .iter()
                .any(|ext| existing.eq_ignore_ascii_case(ext)) =>
        {
            Ok(path.to_path_buf())
        }
        Some(existing) => Err(format!(
            "文件扩展名 .{existing} 不受支持，请使用 .{}",
            extensions.first().copied().unwrap_or("lwd")
        )),
        None => {
            let mut target = path.to_path_buf();
            target.set_extension(extensions.first().copied().unwrap_or("lwd"));
            Ok(target)
        }
    }
}

fn validate_document(document: &Value) -> Result<(), String> {
    let object = document
        .as_object()
        .ok_or_else(|| "文档内容不是有效的 JSON 对象".to_string())?;
    match object.get("type").and_then(Value::as_str) {
        Some("doc") => Ok(()),
        _ => Err("文档内容不是 ProseMirror 文档（缺少 type=doc）".to_string()),
    }
}

fn file_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "无标题".to_string())
}

fn parse_lwd(raw: &str) -> Result<LwdFile, String> {
    let value: Value =
        serde_json::from_str(raw).map_err(|err| format!("不是有效的 JSON：{err}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "文档根节点必须是 JSON 对象".to_string())?;

    let format = object.get("format").and_then(Value::as_str).unwrap_or("");
    if format != FORMAT_NAME {
        return Err("不是轻文 .lwd 文档（format 字段不匹配）".to_string());
    }

    let version = object.get("version").and_then(Value::as_u64).unwrap_or(0);
    if version == 0 {
        return Err("文档缺少有效的 version 字段".to_string());
    }
    if version > u64::from(FORMAT_VERSION) {
        return Err(format!(
            "文档版本为 {version}，当前轻文仅支持 v{FORMAT_VERSION}，请升级应用后再打开"
        ));
    }

    let file: LwdFile =
        serde_json::from_value(value).map_err(|err| format!("文档结构不完整：{err}"))?;
    validate_document(&file.document)?;
    Ok(file)
}

fn parse_draft(raw: &str) -> Result<DraftFile, String> {
    let value: Value =
        serde_json::from_str(raw).map_err(|err| format!("草稿不是有效的 JSON：{err}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "草稿根节点必须是 JSON 对象".to_string())?;

    if object.get("format").and_then(Value::as_str) != Some(DRAFT_FORMAT_NAME) {
        return Err("草稿格式标识不匹配".to_string());
    }
    let version = object.get("version").and_then(Value::as_u64).unwrap_or(0);
    if version != u64::from(FORMAT_VERSION) {
        return Err("草稿版本不兼容".to_string());
    }

    let draft: DraftFile =
        serde_json::from_value(value).map_err(|err| format!("草稿结构不完整：{err}"))?;
    validate_document(&draft.document)?;
    Ok(draft)
}

/// 在目标文件同目录创建临时文件，fsync 后原子 rename。
/// Windows 上 `std::fs::rename` 会覆盖已存在的目标文件。
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|value| !value.as_os_str().is_empty())
        .ok_or_else(|| "无法确定目标文件所在目录".to_string())?;
    fs::create_dir_all(parent).map_err(|err| format!("创建目录失败：{err}"))?;

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let temp_path = parent.join(format!(".{file_name}.{}.{}.tmp", std::process::id(), nonce));

    let result = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temp_path, path)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result.map_err(|err| format!("写入文件失败：{err}"))
}

pub fn read_document(path: &Path) -> Result<LoadedDocument, String> {
    require_absolute(path)?;
    let metadata = fs::metadata(path).map_err(|err| format!("无法读取文件：{err}"))?;
    if !metadata.is_file() {
        return Err("所选路径不是文件".to_string());
    }
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err("文档超过 128 MB，无法打开".to_string());
    }

    let raw = fs::read_to_string(path).map_err(|err| format!("读取文件失败：{err}"))?;
    let raw = raw.strip_prefix('\u{feff}').unwrap_or(raw.as_str());
    let mut file = parse_lwd(raw)?;

    if file.meta.title.trim().is_empty() {
        file.meta.title = file_stem(path);
    }

    Ok(LoadedDocument {
        path: path.to_string_lossy().into_owned(),
        document: file.document,
        meta: file.meta,
        created_at: file.created_at,
        updated_at: file.updated_at,
    })
}

pub fn save_document(
    path: &Path,
    document: Value,
    meta: DocMeta,
    created_at: Option<String>,
) -> Result<SavedDocument, String> {
    require_absolute(path)?;
    let target = ensure_extension(path, &["lwd"])?;
    validate_document(&document)?;

    let created_at = created_at
        .filter(|value| DateTime::parse_from_rfc3339(value).is_ok())
        .unwrap_or_else(now_iso);
    let updated_at = now_iso();
    let meta = DocMeta {
        title: normalize_title(&meta.title),
        word_count: meta.word_count,
        character_count: meta.character_count,
    };

    let file = LwdFile {
        format: FORMAT_NAME.to_string(),
        version: FORMAT_VERSION,
        app: APP_NAME.to_string(),
        created_at: created_at.clone(),
        updated_at: updated_at.clone(),
        meta,
        document,
    };

    let bytes = serde_json::to_vec_pretty(&file).map_err(|err| format!("序列化文档失败：{err}"))?;
    if bytes.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("文档超过 128 MB，无法保存。请减少或压缩图片后重试".to_string());
    }

    write_atomic(&target, &bytes)?;

    Ok(SavedDocument {
        path: target.to_string_lossy().into_owned(),
        created_at,
        updated_at,
        bytes: bytes.len(),
    })
}

fn draft_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("无法定位应用数据目录：{err}"))?;
    Ok(base.join("recovery").join("autosave.lwd"))
}

pub fn save_draft(
    app: &AppHandle,
    document: Value,
    meta: DocMeta,
    file_path: Option<String>,
    title: String,
    created_at: Option<String>,
) -> Result<(), String> {
    validate_document(&document)?;
    let title = normalize_title(&title);
    let created_at = created_at
        .filter(|value| DateTime::parse_from_rfc3339(value).is_ok())
        .unwrap_or_else(now_iso);

    let draft = DraftFile {
        format: DRAFT_FORMAT_NAME.to_string(),
        version: FORMAT_VERSION,
        saved_at: now_iso(),
        file_path,
        title: title.clone(),
        created_at,
        meta: DocMeta {
            title,
            word_count: meta.word_count,
            character_count: meta.character_count,
        },
        document,
    };

    let bytes =
        serde_json::to_vec_pretty(&draft).map_err(|err| format!("序列化草稿失败：{err}"))?;
    if bytes.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("草稿超过 128 MB，已跳过本次备份".to_string());
    }

    write_atomic(&draft_path(app)?, &bytes)
}

pub fn load_draft(app: &AppHandle) -> Result<Option<DraftPayload>, String> {
    let path = draft_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::metadata(&path).map_err(|err| format!("读取草稿信息失败：{err}"))?;
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err("草稿文件异常过大，已忽略".to_string());
    }

    let raw = fs::read_to_string(&path).map_err(|err| format!("读取草稿失败：{err}"))?;
    let raw = raw.strip_prefix('\u{feff}').unwrap_or(raw.as_str());
    let draft = parse_draft(raw)?;

    Ok(Some(DraftPayload {
        saved_at: draft.saved_at,
        file_path: draft.file_path,
        title: draft.meta.title.clone(),
        created_at: draft.created_at,
        meta: draft.meta,
        document: draft.document,
    }))
}

pub fn clear_draft(app: &AppHandle) -> Result<(), String> {
    let path = draft_path(app)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("清理草稿失败：{err}")),
    }
}

pub fn detect_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() >= 8 && bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("image/png")
    } else if bytes.len() >= 3 && bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.len() >= 6 && (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) {
        Some("image/gif")
    } else if bytes.len() >= 12
        && bytes.starts_with(b"RIFF")
        && bytes.get(8..12).is_some_and(|chunk| chunk == b"WEBP")
    {
        Some("image/webp")
    } else {
        None
    }
}

pub fn read_image(path: &Path) -> Result<ImportedImage, String> {
    require_absolute(path)?;
    let metadata = fs::metadata(path).map_err(|err| format!("无法读取图片：{err}"))?;
    if !metadata.is_file() {
        return Err("所选路径不是文件".to_string());
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("图片超过 12 MB，请压缩后再插入".to_string());
    }
    if metadata.len() == 0 {
        return Err("图片文件为空".to_string());
    }

    let bytes = fs::read(path).map_err(|err| format!("读取图片失败：{err}"))?;
    let mime = detect_image_mime(&bytes).ok_or_else(|| {
        "不支持的图片格式。为保证安全，仅支持 PNG、JPEG、WebP、GIF（不支持 SVG）".to_string()
    })?;

    let data_url = format!("data:{mime};base64,{}", BASE64.encode(&bytes));
    Ok(ImportedImage {
        data_url,
        name: file_stem(path),
        mime: mime.to_string(),
        size: metadata.len(),
    })
}

pub fn export_document(path: &Path, content: &str, format: &str) -> Result<String, String> {
    require_absolute(path)?;
    if content.len() > MAX_EXPORT_BYTES {
        return Err("导出内容超过 64 MB，已取消".to_string());
    }

    let extensions: &[&str] = match format {
        "text" => &["txt"],
        "html" => &["html", "htm"],
        _ => return Err("未知的导出格式".to_string()),
    };
    let target = ensure_extension(path, extensions)?;
    write_atomic(&target, content.as_bytes())?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_supported_images() {
        assert_eq!(
            detect_image_mime(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            Some("image/png")
        );
        assert_eq!(
            detect_image_mime(&[0xFF, 0xD8, 0xFF, 0x00]),
            Some("image/jpeg")
        );
        assert_eq!(detect_image_mime(b"GIF89a...."), Some("image/gif"));
        assert_eq!(
            detect_image_mime(b"RIFF\0\0\0\0WEBPVP8 "),
            Some("image/webp")
        );
        assert_eq!(detect_image_mime(b"<svg></svg>"), None);
    }

    #[test]
    fn validates_document_shape() {
        assert!(validate_document(&serde_json::json!({"type": "doc", "content": []})).is_ok());
        assert!(validate_document(&serde_json::json!({"type": "paragraph"})).is_err());
        assert!(validate_document(&serde_json::json!(null)).is_err());
    }

    #[test]
    fn appends_missing_extension() {
        let path = Path::new("C:\\docs\\笔记");
        let target = ensure_extension(path, &["lwd"]).expect("should append extension");
        assert_eq!(
            target.extension().and_then(|value| value.to_str()),
            Some("lwd")
        );
    }

    #[test]
    fn rejects_conflicting_extension() {
        let path = Path::new("C:\\docs\\笔记.docx");
        assert!(ensure_extension(path, &["lwd"]).is_err());
    }
}
