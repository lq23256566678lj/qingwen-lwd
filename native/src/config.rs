use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub default_save_dir: Option<PathBuf>,
    pub autosave_seconds: u64,
    pub webdav_url: String,
    pub webdav_username: String,
    pub auto_cloud_seconds: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_save_dir: None,
            autosave_seconds: 60,
            webdav_url: String::new(),
            webdav_username: String::new(),
            auto_cloud_seconds: 300,
        }
    }
}

fn settings_path() -> Option<PathBuf> {
    if let Ok(directory) = std::env::var("QINGWEN_CONFIG_DIR") {
        return Some(PathBuf::from(directory).join("settings.json"));
    }
    dirs::config_dir().map(|dir| dir.join("qingwen-native").join("settings.json"))
}

pub fn load() -> Settings {
    let Some(path) = settings_path() else {
        return Settings::default();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save(settings: &Settings) {
    let Some(path) = settings_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(raw) = serde_json::to_vec_pretty(settings) {
        let _ = fs::write(path, raw);
    }
}
