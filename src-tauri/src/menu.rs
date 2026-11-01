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
    let close = MenuItem::with_id(app, "close", "关闭窗口", true, Some("CmdOrCtrl+W"))?;
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

    // ---- 编辑 ----
    // 撤销/重做不设置原生快捷键，避免与 ProseMirror 的 keymap 同时触发两次。
    let undo = MenuItem::with_id(app, "undo", "撤销", true, None::<&str>)?;
    let redo = MenuItem::with_id(app, "redo", "重做", true, None::<&str>)?;
    let select_all = MenuItem::with_id(app, "select-all", "全选", true, None::<&str>)?;
    let find = MenuItem::with_id(app, "find", "查找…", true, Some("CmdOrCtrl+F"))?;
    let replace = MenuItem::with_id(app, "replace", "替换…", true, Some("CmdOrCtrl+H"))?;
    let edit_sep_1 = PredefinedMenuItem::separator(app)?;
    let edit_sep_2 = PredefinedMenuItem::separator(app)?;
    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &undo,
            &redo,
            &edit_sep_1,
            &select_all,
            &edit_sep_2,
            &find,
            &replace,
        ],
    )?;

    // ---- 格式 ----
    let bold = MenuItem::with_id(app, "bold", "加粗", true, None::<&str>)?;
    let italic = MenuItem::with_id(app, "italic", "斜体", true, None::<&str>)?;
    let underline = MenuItem::with_id(app, "underline", "下划线", true, None::<&str>)?;
    let strike = MenuItem::with_id(app, "strike", "删除线", true, None::<&str>)?;
    let paragraph = MenuItem::with_id(app, "paragraph", "正文", true, None::<&str>)?;
    let heading_1 = MenuItem::with_id(app, "heading-1", "标题 1", true, None::<&str>)?;
    let heading_2 = MenuItem::with_id(app, "heading-2", "标题 2", true, None::<&str>)?;
    let heading_3 = MenuItem::with_id(app, "heading-3", "标题 3", true, None::<&str>)?;
    let heading_4 = MenuItem::with_id(app, "heading-4", "标题 4", true, None::<&str>)?;
    let bullet_list = MenuItem::with_id(app, "bullet-list", "项目符号列表", true, None::<&str>)?;
    let ordered_list = MenuItem::with_id(app, "ordered-list", "编号列表", true, None::<&str>)?;
    let blockquote = MenuItem::with_id(app, "blockquote", "引用", true, None::<&str>)?;
    let code_block = MenuItem::with_id(app, "code-block", "代码块", true, None::<&str>)?;
    let clear_format = MenuItem::with_id(app, "clear-format", "清除格式", true, None::<&str>)?;
    let insert_table = MenuItem::with_id(app, "insert-table", "插入 3×3 表格", true, None::<&str>)?;
    let insert_image = MenuItem::with_id(app, "insert-image", "插入图片…", true, None::<&str>)?;

    let format_sep_1 = PredefinedMenuItem::separator(app)?;
    let format_sep_2 = PredefinedMenuItem::separator(app)?;
    let format_sep_3 = PredefinedMenuItem::separator(app)?;
    let format_sep_4 = PredefinedMenuItem::separator(app)?;
    let format_menu = Submenu::with_items(
        app,
        "格式",
        true,
        &[
            &bold,
            &italic,
            &underline,
            &strike,
            &format_sep_1,
            &paragraph,
            &heading_1,
            &heading_2,
            &heading_3,
            &heading_4,
            &format_sep_2,
            &bullet_list,
            &ordered_list,
            &blockquote,
            &code_block,
            &format_sep_3,
            &clear_format,
            &format_sep_4,
            &insert_table,
            &insert_image,
        ],
    )?;

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
    let mut items: Vec<&dyn IsMenuItem<Wry>> =
        vec![&file_menu, &edit_menu, &format_menu, &help_menu];

    #[cfg(target_os = "macos")]
    {
        let app_sep = PredefinedMenuItem::separator(app)?;
        let app_menu = Submenu::with_items(app, "轻文", true, &[&about, &app_sep, &quit])?;
        items.insert(0, &app_menu);
    }

    Menu::with_items(app, &items)
}
