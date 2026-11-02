//! WebDAV 云盘同步与同步设置。
//!
//! URL/间隔写入 `appDataDir/sync.json`；用户名/密码只写入系统钥匙串
//! （Windows Credential Manager / macOS Keychain / Linux Secret Service），
//! 不落配置文件，也不写日志。

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::storage::{self, DocMeta, LoadedDocument, SavedDocument};

const SYNC_CONFIG_VERSION: u32 = 1;
const KEYRING_SERVICE: &str = "com.qingwen.lwd.webdav";
const KEYRING_ACCOUNT: &str = "credentials";
const DEFAULT_LOCAL_AUTOSAVE_SECONDS: u64 = 60;
const DEFAULT_CLOUD_UPLOAD_SECONDS: u64 = 300;
const MIN_LOCAL_AUTOSAVE_SECONDS: u64 = 5;
const MIN_CLOUD_UPLOAD_SECONDS: u64 = 30;
const MAX_INTERVAL_SECONDS: u64 = 86_400;
const MAX_REMOTE_BYTES: u64 = 128 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_local_autosave")]
    pub local_autosave_seconds: u64,
    #[serde(default = "default_cloud_upload")]
    pub cloud_upload_seconds: u64,
    #[serde(default)]
    pub default_save_dir: String,
}

fn default_local_autosave() -> u64 {
    DEFAULT_LOCAL_AUTOSAVE_SECONDS
}

fn default_cloud_upload() -> u64 {
    DEFAULT_CLOUD_UPLOAD_SECONDS
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            version: SYNC_CONFIG_VERSION,
            url: String::new(),
            local_autosave_seconds: DEFAULT_LOCAL_AUTOSAVE_SECONDS,
            cloud_upload_seconds: DEFAULT_CLOUD_UPLOAD_SECONDS,
            default_save_dir: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettings {
    pub url: String,
    pub local_autosave_seconds: u64,
    pub cloud_upload_seconds: u64,
    pub default_save_dir: String,
    pub username: String,
    pub has_password: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WebDavCredentials {
    #[serde(default)]
    username: String,
    #[serde(default)]
    password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavUploadResult {
    pub status: u16,
    pub bytes: u64,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("无法定位应用数据目录：{err}"))?;
    fs::create_dir_all(&dir).map_err(|err| format!("无法创建应用数据目录：{err}"))?;
    Ok(dir.join("sync.json"))
}

fn load_config(app: &AppHandle) -> SyncConfig {
    let path = match config_path(app) {
        Ok(path) => path,
        Err(_) => return SyncConfig::default(),
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return SyncConfig::default();
    };
    let mut config: SyncConfig = serde_json::from_str(&raw).unwrap_or_default();
    config.version = SYNC_CONFIG_VERSION;
    config.local_autosave_seconds = sanitize_local_interval(config.local_autosave_seconds);
    config.cloud_upload_seconds = sanitize_cloud_interval(config.cloud_upload_seconds);
    config
}

fn sanitize_local_interval(value: u64) -> u64 {
    if value == 0 {
        return 0;
    }
    value.clamp(MIN_LOCAL_AUTOSAVE_SECONDS, MAX_INTERVAL_SECONDS)
}

fn sanitize_cloud_interval(value: u64) -> u64 {
    if value == 0 {
        return 0;
    }
    value.clamp(MIN_CLOUD_UPLOAD_SECONDS, MAX_INTERVAL_SECONDS)
}

fn normalize_base_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    let url = reqwest::Url::parse(trimmed).map_err(|err| format!("服务器 URL 无效：{err}"))?;
    match url.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("WebDAV 仅支持 http/https，当前为 {scheme}")),
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("服务器 URL 不应包含查询参数或 # 片段".to_string());
    }
    let mut serialized = url.to_string();
    if !serialized.ends_with('/') {
        serialized.push('/');
    }
    Ok(serialized)
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|err| format!("无法访问系统钥匙串：{err}"))
}

fn load_credentials() -> Option<WebDavCredentials> {
    let entry = keyring_entry().ok()?;
    let raw = entry.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

fn save_credentials(credentials: &WebDavCredentials) -> Result<(), String> {
    let entry = keyring_entry()?;
    let raw = serde_json::to_string(credentials).map_err(|err| format!("无法序列化凭据：{err}"))?;
    entry
        .set_password(&raw)
        .map_err(|err| format!("无法写入系统钥匙串：{err}"))
}

fn delete_credentials() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("无法删除系统钥匙串中的凭据：{err}")),
    }
}

fn normalize_default_save_dir(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("默认保存路径必须是绝对路径".to_string());
    }
    let metadata = fs::metadata(&path).map_err(|err| format!("无法访问默认保存文件夹：{err}"))?;
    if !metadata.is_dir() {
        return Err("默认保存路径不是文件夹".to_string());
    }
    Ok(path.to_string_lossy().into_owned())
}

fn current_settings(app: &AppHandle) -> SyncSettings {
    let config = load_config(app);
    let credentials = load_credentials();
    SyncSettings {
        url: config.url,
        local_autosave_seconds: config.local_autosave_seconds,
        cloud_upload_seconds: config.cloud_upload_seconds,
        default_save_dir: config.default_save_dir,
        username: credentials
            .as_ref()
            .map(|value| value.username.clone())
            .unwrap_or_default(),
        has_password: credentials
            .as_ref()
            .map(|value| !value.password.is_empty())
            .unwrap_or(false),
    }
}

pub fn load_settings(app: &AppHandle) -> Result<SyncSettings, String> {
    Ok(current_settings(app))
}

pub fn save_settings(
    app: &AppHandle,
    url: String,
    username: String,
    password: String,
    local_autosave_seconds: u64,
    cloud_upload_seconds: u64,
    default_save_dir: String,
    clear_credentials: bool,
) -> Result<SyncSettings, String> {
    let url = normalize_base_url(&url)?;
    let default_save_dir = normalize_default_save_dir(&default_save_dir)?;
    let config = SyncConfig {
        version: SYNC_CONFIG_VERSION,
        url,
        local_autosave_seconds: sanitize_local_interval(local_autosave_seconds),
        cloud_upload_seconds: sanitize_cloud_interval(cloud_upload_seconds),
        default_save_dir,
    };
    let raw =
        serde_json::to_vec_pretty(&config).map_err(|err| format!("无法序列化同步设置：{err}"))?;
    storage::write_atomic(&config_path(app)?, &raw)?;

    if clear_credentials {
        delete_credentials()?;
    } else {
        let existing = load_credentials().unwrap_or(WebDavCredentials {
            username: String::new(),
            password: String::new(),
        });
        let username = username.trim().to_string();
        let password = if password.is_empty() {
            existing.password
        } else {
            password
        };
        if username.is_empty() && password.is_empty() {
            delete_credentials()?;
        } else {
            save_credentials(&WebDavCredentials { username, password })?;
        }
    }

    Ok(current_settings(app))
}

fn validate_remote_url(raw: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(raw.trim()).map_err(|err| format!("远程 URL 无效：{err}"))?;
    match url.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("WebDAV 仅支持 http/https，当前为 {scheme}")),
    }
    Ok(url)
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent("Qingwen-LWD/0.1")
        .build()
        .map_err(|err| format!("无法初始化网络客户端：{err}"))
}

fn error_snippet(body: &[u8]) -> String {
    let text = String::from_utf8_lossy(body);
    let text = text.trim().replace(['\r', '\n'], " ");
    text.chars().take(180).collect()
}

pub async fn upload(
    _app: &AppHandle,
    remote_url: String,
    document: Value,
    meta: DocMeta,
    created_at: Option<String>,
) -> Result<WebDavUploadResult, String> {
    let url = validate_remote_url(&remote_url)?;
    let bytes = storage::encode_document(document, meta, created_at)?;
    let length = bytes.len() as u64;
    let credentials = load_credentials();
    let client = http_client()?;

    let mut request = client
        .put(url)
        .header("Content-Type", "application/vnd.qingwen.lwd+json")
        .body(bytes);
    if let Some(credentials) = credentials {
        request = request.basic_auth(credentials.username, Some(credentials.password));
    }

    let response = request
        .send()
        .await
        .map_err(|err| format!("上传请求失败：{err}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.bytes().await.unwrap_or_default();
        let snippet = error_snippet(&body);
        return Err(if snippet.is_empty() {
            format!("WebDAV 返回 HTTP {}", status.as_u16())
        } else {
            format!("WebDAV 返回 HTTP {}：{snippet}", status.as_u16())
        });
    }

    Ok(WebDavUploadResult {
        status: status.as_u16(),
        bytes: length,
    })
}

pub async fn download(_app: &AppHandle, remote_url: String) -> Result<LoadedDocument, String> {
    let url = validate_remote_url(&remote_url)?;
    let credentials = load_credentials();
    let client = http_client()?;

    let mut request = client.get(url);
    if let Some(credentials) = credentials {
        request = request.basic_auth(credentials.username, Some(credentials.password));
    }

    let response = request
        .send()
        .await
        .map_err(|err| format!("下载请求失败：{err}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.bytes().await.unwrap_or_default();
        let snippet = error_snippet(&body);
        return Err(if snippet.is_empty() {
            format!("WebDAV 返回 HTTP {}", status.as_u16())
        } else {
            format!("WebDAV 返回 HTTP {}：{snippet}", status.as_u16())
        });
    }
    if let Some(length) = response.content_length() {
        if length > MAX_REMOTE_BYTES {
            return Err("远程文档超过 128 MB，无法下载".to_string());
        }
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("读取远程文档失败：{err}"))?;
    if bytes.len() as u64 > MAX_REMOTE_BYTES {
        return Err("远程文档超过 128 MB，无法下载".to_string());
    }
    storage::decode_document(&bytes)
}

fn validate_directory(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder.trim());
    if path.as_os_str().is_empty() {
        return Err("默认保存文件夹为空".to_string());
    }
    if !path.is_absolute() {
        return Err("默认保存文件夹必须是绝对路径".to_string());
    }
    let metadata = fs::metadata(&path).map_err(|err| format!("无法访问保存文件夹：{err}"))?;
    if !metadata.is_dir() {
        return Err("默认保存路径不是文件夹".to_string());
    }
    Ok(path)
}

fn sanitize_file_stem(raw: &str) -> String {
    let raw = raw.trim();
    let raw = raw
        .strip_suffix(".lwd")
        .or_else(|| raw.strip_suffix(".LWD"))
        .unwrap_or(raw);

    let mut cleaned = String::new();
    for character in raw.chars().take(120) {
        if character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
        {
            cleaned.push(' ');
        } else {
            cleaned.push(character);
        }
    }
    let mut stem = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    stem = stem
        .trim_matches(|character| character == '.' || character == ' ')
        .to_string();
    if stem.is_empty() {
        stem = "未命名文档".to_string();
    }

    let upper = stem.to_ascii_uppercase();
    let reserved = matches!(
        upper.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    );
    if reserved {
        stem = format!("_{stem}");
    }
    stem
}

fn unique_document_path(folder: &Path, stem: &str) -> PathBuf {
    for index in 1..10_000u32 {
        let name = if index == 1 {
            format!("{stem}.lwd")
        } else {
            format!("{stem} {index}.lwd")
        };
        let candidate = folder.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    folder.join(format!("{stem} {}.lwd", chrono::Utc::now().timestamp()))
}

pub fn create_local_document(
    folder: String,
    title: String,
    document: Value,
    mut meta: DocMeta,
) -> Result<SavedDocument, String> {
    let folder = validate_directory(&folder)?;
    let stem = sanitize_file_stem(&title);
    let path = unique_document_path(&folder, &stem);
    meta.title = stem;
    storage::save_document(&path, document, meta, None)
}

pub fn rename_local_document(
    old_path: String,
    folder: String,
    title: String,
) -> Result<String, String> {
    let folder = validate_directory(&folder)?;
    let old_path = PathBuf::from(old_path.trim());
    if !old_path.is_absolute() {
        return Err("旧文件路径必须是绝对路径".to_string());
    }
    if !old_path.is_file() {
        return Err("旧文件不存在或不是文件".to_string());
    }
    if old_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case("lwd"))
        .unwrap_or(true)
    {
        return Err("只能重命名 .lwd 文档".to_string());
    }

    let folder_canonical =
        fs::canonicalize(&folder).map_err(|err| format!("无法解析保存文件夹：{err}"))?;
    let parent = old_path
        .parent()
        .ok_or_else(|| "无法确定旧文件所在目录".to_string())?;
    let parent_canonical =
        fs::canonicalize(parent).map_err(|err| format!("无法解析旧文件目录：{err}"))?;
    if folder_canonical != parent_canonical {
        return Err("旧文件不在默认保存文件夹中".to_string());
    }

    let stem = sanitize_file_stem(&title);
    let current_stem = old_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if current_stem == stem {
        storage::retitle_document(&old_path, &stem)?;
        return Ok(old_path.to_string_lossy().into_owned());
    }

    let new_path = unique_document_path(&folder, &stem);
    fs::rename(&old_path, &new_path).map_err(|err| format!("重命名本地文档失败：{err}"))?;
    if let Err(error) = storage::retitle_document(&new_path, &stem) {
        let _ = fs::rename(&new_path, &old_path);
        return Err(error);
    }
    Ok(new_path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn local_document_create_and_rename() {
        let folder = std::env::temp_dir().join(format!(
            "qingwen-local-test-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&folder).expect("create temp folder");
        let folder_string = folder.to_string_lossy().into_owned();
        let meta = DocMeta {
            title: "未命名文档".to_string(),
            word_count: 0,
            character_count: 0,
            layout: None,
        };
        let document = json!({"type": "doc", "content": []});

        let created = create_local_document(
            folder_string.clone(),
            "未命名文档".to_string(),
            document.clone(),
            meta.clone(),
        )
        .expect("create local document");
        assert!(created.path.ends_with("未命名文档.lwd"));
        assert!(Path::new(&created.path).is_file());

        let created_again = create_local_document(
            folder_string.clone(),
            "未命名文档".to_string(),
            document,
            meta,
        )
        .expect("create second local document");
        assert!(created_again.path.ends_with("未命名文档 2.lwd"));

        let renamed =
            rename_local_document(created.path.clone(), folder_string, "我的笔记".to_string())
                .expect("rename local document");
        assert!(renamed.ends_with("我的笔记.lwd"));
        assert!(Path::new(&renamed).is_file());
        assert!(!Path::new(&created.path).exists());
        let loaded = storage::read_document(Path::new(&renamed)).expect("read renamed");
        assert_eq!(loaded.meta.title, "我的笔记");

        let _ = fs::remove_dir_all(folder);
    }
}
