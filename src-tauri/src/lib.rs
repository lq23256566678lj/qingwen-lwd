//! 轻文 LWD 的 Tauri 后端入口。
//!
//! 前端只通过一组收窄的命令访问磁盘：读取/保存 .lwd、自动保存草稿、
//! 导入图片、导出纯文本/HTML、退出应用。没有向 WebView 开放通用文件系统权限。

mod menu;
mod storage;
mod sync;

use std::path::Path;

use serde_json::Value;
use tauri::{AppHandle, Emitter};

use storage::{DocMeta, DraftPayload, ImportedImage, LoadedDocument, SavedDocument};
use sync::{SyncSettings, WebDavUploadResult};

#[tauri::command]
fn read_document(path: String) -> Result<LoadedDocument, String> {
    storage::read_document(Path::new(&path))
}

#[tauri::command]
fn save_document(
    path: String,
    document: Value,
    meta: DocMeta,
    created_at: Option<String>,
) -> Result<SavedDocument, String> {
    storage::save_document(Path::new(&path), document, meta, created_at)
}

#[tauri::command]
fn save_draft(
    app: AppHandle,
    document: Value,
    meta: DocMeta,
    file_path: Option<String>,
    title: String,
    created_at: Option<String>,
) -> Result<(), String> {
    storage::save_draft(&app, document, meta, file_path, title, created_at)
}

#[tauri::command]
fn load_draft(app: AppHandle) -> Result<Option<DraftPayload>, String> {
    storage::load_draft(&app)
}

#[tauri::command]
fn clear_draft(app: AppHandle) -> Result<(), String> {
    storage::clear_draft(&app)
}

#[tauri::command]
fn read_image_as_data_url(path: String) -> Result<ImportedImage, String> {
    storage::read_image(Path::new(&path))
}

#[tauri::command]
fn export_document(path: String, content: String, format: String) -> Result<String, String> {
    storage::export_document(Path::new(&path), &content, &format)
}

#[tauri::command]
fn save_workspace_session(app: AppHandle, session: Value) -> Result<(), String> {
    storage::save_session(&app, session)
}

#[tauri::command]
fn load_workspace_session(app: AppHandle) -> Result<Option<Value>, String> {
    storage::load_session(&app)
}

#[tauri::command]
fn clear_workspace_session(app: AppHandle) -> Result<(), String> {
    storage::clear_session(&app)
}

#[tauri::command]
fn load_sync_settings(app: AppHandle) -> Result<SyncSettings, String> {
    sync::load_settings(&app)
}

#[tauri::command]
fn save_sync_settings(
    app: AppHandle,
    url: String,
    username: String,
    password: String,
    local_autosave_seconds: u64,
    cloud_upload_seconds: u64,
    default_save_dir: String,
    clear_credentials: bool,
) -> Result<SyncSettings, String> {
    sync::save_settings(
        &app,
        url,
        username,
        password,
        local_autosave_seconds,
        cloud_upload_seconds,
        default_save_dir,
        clear_credentials,
    )
}

#[tauri::command]
fn create_local_document(
    folder: String,
    title: String,
    document: Value,
    meta: DocMeta,
) -> Result<SavedDocument, String> {
    sync::create_local_document(folder, title, document, meta)
}

#[tauri::command]
fn rename_local_document(
    old_path: String,
    folder: String,
    title: String,
) -> Result<String, String> {
    sync::rename_local_document(old_path, folder, title)
}

#[tauri::command]
async fn webdav_upload(
    app: AppHandle,
    remote_url: String,
    document: Value,
    meta: DocMeta,
    created_at: Option<String>,
) -> Result<WebDavUploadResult, String> {
    sync::upload(&app, remote_url, document, meta, created_at).await
}

#[tauri::command]
async fn webdav_download(app: AppHandle, remote_url: String) -> Result<LoadedDocument, String> {
    sync::download(&app, remote_url).await
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let menu = menu::build(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            // 菜单事件只传动作 id，由前端决定如何执行（并保留撤销栈/焦点）。
            let action = event.id().0.clone();
            if let Err(err) = app.emit("lwd://menu", action) {
                eprintln!("[qingwen] 发送菜单事件失败: {err}");
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_document,
            save_document,
            save_draft,
            load_draft,
            clear_draft,
            read_image_as_data_url,
            export_document,
            save_workspace_session,
            load_workspace_session,
            clear_workspace_session,
            load_sync_settings,
            save_sync_settings,
            create_local_document,
            rename_local_document,
            webdav_upload,
            webdav_download,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("启动轻文失败");
}
