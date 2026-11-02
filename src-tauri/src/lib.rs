//! 轻文 LWD 的 Tauri 后端入口。
//!
//! 前端只通过一组收窄的命令访问磁盘：读取/保存 .lwd、自动保存草稿、
//! 导入图片、导出纯文本/HTML、退出应用。没有向 WebView 开放通用文件系统权限。

mod menu;
mod storage;
mod sync;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

use storage::{DocMeta, DraftPayload, ImportedImage, LoadedDocument, SavedDocument};
use sync::{SyncSettings, WebDavUploadResult};

#[derive(Default)]
struct PendingOpenFiles(Mutex<Vec<String>>);

fn is_lwd_path(value: &str) -> bool {
    let path = Path::new(value);
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("lwd"))
        .unwrap_or(false)
        && path.is_file()
}

fn lwd_paths_from_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut paths = Vec::new();
    for arg in args {
        let raw = arg.as_ref().trim().trim_matches('"');
        if raw.is_empty() || raw.starts_with('-') || !is_lwd_path(raw) {
            continue;
        }
        let path = PathBuf::from(raw).to_string_lossy().into_owned();
        if !paths.contains(&path) {
            paths.push(path);
        }
    }
    paths
}

fn queue_open_file(app: &AppHandle, path: String) {
    if !is_lwd_path(&path) {
        return;
    }
    if let Some(state) = app.try_state::<PendingOpenFiles>() {
        if let Ok(mut pending) = state.0.lock() {
            if !pending.contains(&path) {
                pending.push(path.clone());
            }
        }
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    if let Err(error) = app.emit("lwd://open-file", path) {
        eprintln!("[qingwen] 发送打开文件事件失败: {error}");
    }
}

#[tauri::command]
fn take_pending_open_files(state: State<'_, PendingOpenFiles>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut pending| std::mem::take(&mut *pending))
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn reg_add(key: &str, name: Option<&str>, value: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let mut command = std::process::Command::new("reg");
    command.arg("add").arg(key);
    match name {
        Some(name) => {
            command.arg("/v").arg(name);
        }
        None => {
            command.arg("/ve");
        }
    }
    command
        .arg("/d")
        .arg(value)
        .arg("/f")
        .creation_flags(0x0800_0000);

    let output = command
        .output()
        .map_err(|error| format!("无法运行 reg.exe：{error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if message.is_empty() {
            format!("写入注册表失败：{key}")
        } else {
            message
        })
    }
}

#[cfg(target_os = "windows")]
fn register_windows_lwd_association() -> Result<(), String> {
    let executable =
        std::env::current_exe().map_err(|error| format!("无法定位程序路径：{error}"))?;
    let executable_text = executable.to_string_lossy();
    let executable_name = executable
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("qingwen.exe");
    let prog_id = "Qingwen.LWD.Document";
    let icon = format!("\"{executable_text}\",0");
    let open_command = format!("\"{executable_text}\" \"%1\"");

    reg_add(r"HKCU\Software\Classes\.lwd", None, prog_id)?;
    reg_add(
        &format!(r"HKCU\Software\Classes\{prog_id}"),
        None,
        "轻文 LWD 文档",
    )?;
    reg_add(
        &format!(r"HKCU\Software\Classes\{prog_id}\DefaultIcon"),
        None,
        &icon,
    )?;
    reg_add(
        &format!(r"HKCU\Software\Classes\{prog_id}\shell\open\command"),
        None,
        &open_command,
    )?;
    reg_add(
        r"HKCU\Software\Classes\.lwd\OpenWithProgids",
        Some(prog_id),
        "",
    )?;
    reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.lwd\OpenWithProgids",
        Some(prog_id),
        "",
    )?;

    let application_key = format!(r"HKCU\Software\Classes\Applications\{executable_name}");
    reg_add(&application_key, Some("FriendlyAppName"), "轻文 LWD")?;
    reg_add(
        &format!(r"{application_key}\SupportedTypes"),
        Some(".lwd"),
        "",
    )?;
    reg_add(
        &format!(r"{application_key}\shell\open\command"),
        None,
        &open_command,
    )?;
    Ok(())
}

#[tauri::command]
fn repair_lwd_association() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        register_windows_lwd_association()?;
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:defaultapps"])
            .spawn();
        Ok("已注册 .lwd 文件关联。若 Windows 仍弹出“打开方式”，请在设置中把 .lwd 默认应用选为“轻文 LWD”，之后双击即可直接打开。".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("安装包已包含 .lwd 文件类型关联；请在系统默认应用中确认“轻文 LWD”。".to_string())
    }
}

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
    let builder = tauri::Builder::default()
        .manage(PendingOpenFiles::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let menu = menu::build(app.handle())?;
            app.set_menu(menu)?;
            for path in lwd_paths_from_args(std::env::args().skip(1)) {
                queue_open_file(app.handle(), path);
            }
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
            take_pending_open_files,
            repair_lwd_association,
            quit_app
        ]);

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        for path in lwd_paths_from_args(argv) {
            queue_open_file(app, path);
        }
    }));

    let app = builder
        .build(tauri::generate_context!())
        .expect("启动轻文失败");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    queue_open_file(app_handle, path.to_string_lossy().into_owned());
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}
