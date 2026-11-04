use std::time::Duration;

use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "com.qingwen.lwd.webdav";
const KEYRING_ACCOUNT: &str = "credentials";
const MAX_REMOTE_BYTES: u64 = 128 * 1024 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|error| format!("无法访问系统钥匙串：{error}"))
}

pub fn load_credentials() -> Option<Credentials> {
    let entry = keyring_entry().ok()?;
    let raw = entry.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save_credentials(credentials: &Credentials) -> Result<(), String> {
    let entry = keyring_entry()?;
    let raw = serde_json::to_string(credentials)
        .map_err(|error| format!("无法序列化凭据：{error}"))?;
    entry
        .set_password(&raw)
        .map_err(|error| format!("无法写入系统钥匙串：{error}"))
}

pub fn normalize_base_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("WebDAV URL 为空".to_string());
    }
    let url = reqwest::Url::parse(trimmed).map_err(|error| format!("WebDAV URL 无效：{error}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("WebDAV 仅支持 http/https".to_string());
    }
    Ok(trimmed.to_string())
}

pub fn remote_url(base: &str, filename: &str) -> Result<String, String> {
    let base = normalize_base_url(base)?;
    let filename = if filename.to_ascii_lowercase().ends_with(".lwd") {
        filename.to_string()
    } else {
        format!("{filename}.lwd")
    };
    Ok(format!("{base}/{}", urlencoding::encode(&filename)))
}

fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("无法创建网络客户端：{error}"))
}

fn response_error(response: reqwest::blocking::Response) -> String {
    let status = response.status();
    let body = response.bytes().unwrap_or_default();
    let text = String::from_utf8_lossy(&body);
    let snippet: String = text.trim().replace(['\r', '\n'], " ").chars().take(180).collect();
    if snippet.is_empty() {
        format!("WebDAV 返回 HTTP {}", status.as_u16())
    } else {
        format!("WebDAV 返回 HTTP {}：{snippet}", status.as_u16())
    }
}

pub fn upload(base: &str, filename: &str, bytes: &[u8]) -> Result<(), String> {
    let url = remote_url(base, filename)?;
    let mut request = client()?
        .put(&url)
        .header("Content-Type", "application/vnd.qingwen.lwd+json")
        .body(bytes.to_vec());
    if let Some(credentials) = load_credentials() {
        request = request.basic_auth(credentials.username, Some(credentials.password));
    }
    let response = request
        .send()
        .map_err(|error| format!("上传请求失败：{error}"))?;
    if !response.status().is_success() {
        return Err(response_error(response));
    }
    Ok(())
}

pub fn download(base: &str, filename: &str) -> Result<Vec<u8>, String> {
    let url = remote_url(base, filename)?;
    let mut request = client()?.get(&url);
    if let Some(credentials) = load_credentials() {
        request = request.basic_auth(credentials.username, Some(credentials.password));
    }
    let response = request
        .send()
        .map_err(|error| format!("下载请求失败：{error}"))?;
    if !response.status().is_success() {
        return Err(response_error(response));
    }
    let bytes = response
        .bytes()
        .map_err(|error| format!("读取远程文档失败：{error}"))?;
    if bytes.len() as u64 > MAX_REMOTE_BYTES {
        return Err("远程文档超过 128 MB".to_string());
    }
    Ok(bytes.to_vec())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_file_names_are_joined_and_encoded() {
        assert_eq!(
            remote_url("https://example.com/dav/qingwen/", "我的 文档").unwrap(),
            "https://example.com/dav/qingwen/%E6%88%91%E7%9A%84%20%E6%96%87%E6%A1%A3.lwd"
        );
        assert!(normalize_base_url("ftp://example.com").is_err());
        assert!(normalize_base_url("").is_err());
    }
}
