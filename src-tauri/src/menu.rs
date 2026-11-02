//! 原生菜单栏。快捷键遵循平台习惯：Windows/Linux 使用 Ctrl，macOS 使用 ⌘。
//!
//! 菜单只负责“发出意图”，真正的编辑器操作由前端执行。这样撤销栈、焦点和
//! 未保存状态始终只有一份，不会出现原生菜单与 WebView 各自维护状态的问题。

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Wry};

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    // ---- 文件 ----
    let new = MenuItem::with_id(app, "new", "新建", true, Some("CmdOrCtrl+N"))?;
    let open = MenuItem::with_id(app, "open", "打开…", true, Some("CmdOrCtrl+O"))?;
    let save = MenuItem::with_id(app, "save", "保存", true, Some("CmdOrCtrl+S"))?;
    let save_as = MenuItem::with_id(app, "save-as", "另存为…", true, Some("CmdOrCtrl+Shift+S"))?;
    let export_text = MenuItem::with_id(app, "export-text", "导出为纯文本…", true, None::<&str>)?;
    let export_html = MenuItem::with_id(app, "export-html", "导出为 HTML…", true, None::<&str>)?;
    let close = MenuItem::with_id(app, "close", "关闭标签页", true, Some("CmdOrCtrl+W"))?;
    let quit = MenuItem::with_id(
        app,
        "quit",
        "退出轻文",
        true,
        if cfg!(target_os = "macos") {
            Some("CmdOrCtrl+Q")
        } else {
            None
        },
    )?;

    let file_sep_1 = PredefinedMenuItem::separator(app)?;
    let file_sep_2 = PredefinedMenuItem::separator(app)?;
    let file_sep_3 = PredefinedMenuItem::separator(app)?;

    #[cfg(target_os = "macos")]
    let file_items: Vec<&dyn IsMenuItem<Wry>> = vec![
        &new,
        &open,
        &file_sep_1,
        &save,
        &save_as,
        &file_sep_2,
        &export_text,
        &export_html,
        &file_sep_3,
        &close,
    ];
    #[cfg(not(target_os = "macos"))]
    let file_items: Vec<&dyn IsMenuItem<Wry>> = vec![
        &new,
        &open,
        &file_sep_1,
        &save,
        &save_as,
        &file_sep_2,
        &export_text,
        &export_html,
        &file_sep_3,
        &close,
        &quit,
    ];
    let file_menu = Submenu::with_items(app, "文件", true, &file_items)?;

    // ---- 帮助 ----
    let about = MenuItem::with_id(app, "about", "关于轻文", true, None::<&str>)?;
    let shortcuts = MenuItem::with_id(app, "shortcuts", "键盘快捷键", true, None::<&str>)?;
    #[cfg(not(target_os = "macos"))]
    let help_sep = PredefinedMenuItem::separator(app)?;
    #[cfg(target_os = "macos")]
    let help_menu = Submenu::with_items(app, "帮助", true, &[&shortcuts])?;
    #[cfg(not(target_os = "macos"))]
    let help_menu = Submenu::with_items(app, "帮助", true, &[&shortcuts, &help_sep, &about])?;

    // macOS 需要在最前面插入应用菜单；其它平台不需要 mut。
    #[allow(unused_mut)]
    let mut items: Vec<&dyn IsMenuItem<Wry>> = vec![&file_menu, &help_menu];

    #[cfg(target_os = "macos")]
    let app_sep = PredefinedMenuItem::separator(app)?;
    // 必须把 app_menu 放在函数作用域，items 持有它的引用，不能在大括号内提前 drop。
    #[cfg(target_os = "macos")]
    let app_menu = Submenu::with_items(app, "轻文", true, &[&about, &app_sep, &quit])?;
    #[cfg(target_os = "macos")]
    items.insert(0, &app_menu);

    Menu::with_items(app, &items)
}
