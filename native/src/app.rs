use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::{Duration, Instant};

use base64::Engine;
use single_instance::SingleInstance;

use eframe::egui;
use egui::text::LayoutJob;
use egui::{
    Align, Color32, FontData, FontDefinitions, FontFamily, FontId, Frame, RichText,
    ScrollArea, Stroke, TextureHandle, TextEdit, TextStyle, Ui, Vec2,
};
use serde_json::json;

use crate::config::{self, Settings};
use crate::lwd::{self, now_iso, title_from_path};
use crate::pdf;
use crate::webdav;
use crate::model::{
    adjust_marks_after_edit, apply_marks, byte_index, Block, BlockKind, Document, Marks, PageLayout,
    TableCell, TableData,
};

const PAGE_WIDTH: f32 = 700.0;
const PAGE_MARGIN_X: f32 = 52.0;
const PAGE_MARGIN_Y: f32 = 48.0;

#[derive(Clone, Copy, Debug)]
enum MarkAction {
    Bold,
    Italic,
    Underline,
    Strike,
    Code,
    Highlight,
    Clear,
}

struct Tab {
    id: u64,
    title: String,
    path: Option<PathBuf>,
    document: Document,
    dirty: bool,
    created_at: String,
    updated_at: Option<String>,
    error: Option<String>,
    undo: Vec<Document>,
    redo: Vec<Document>,
}

impl Tab {
    fn blank(id: u64, block_id: u64, layout: PageLayout) -> Self {
        let mut document = Document::blank(layout);
        document
            .blocks
            .push(Block::new(block_id, BlockKind::Paragraph, String::new()));
        Self {
            id,
            title: "未命名文档".to_string(),
            path: None,
            document,
            dirty: false,
            created_at: now_iso(),
            updated_at: None,
            error: None,
            undo: Vec::new(),
            redo: Vec::new(),
        }
    }

    fn push_undo(&mut self, snapshot: Document) {
        self.undo.push(snapshot);
        if self.undo.len() > 120 {
            self.undo.remove(0);
        }
        self.redo.clear();
    }

    fn undo(&mut self) -> bool {
        let Some(previous) = self.undo.pop() else {
            return false;
        };
        self.redo.push(self.document.clone());
        self.document = previous;
        self.dirty = true;
        true
    }

    fn redo(&mut self) -> bool {
        let Some(next) = self.redo.pop() else {
            return false;
        };
        self.undo.push(self.document.clone());
        self.document = next;
        self.dirty = true;
        true
    }
}

#[derive(Clone, Debug)]
struct CloudResult {
    tab_id: u64,
    hash: u64,
    result: Result<(), String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RibbonTab {
    Home,
    Insert,
    Layout,
    Table,
    View,
}

#[derive(Clone, Copy, Debug)]
enum TableAction {
    AddRow,
    AddColumn,
    RemoveRow,
    RemoveColumn,
}

#[derive(Clone, Copy, Debug)]
struct FindMatch {
    block_id: u64,
    start: usize,
    end: usize,
}

pub struct NativeApp {
    tabs: Vec<Tab>,
    active: usize,
    next_tab_id: u64,
    next_block_id: u64,
    settings: Settings,
    status: String,
    selection: Option<(u64, usize, usize)>,
    focus_block: Option<u64>,
    pending_format: Option<MarkAction>,
    page_setup_open: bool,
    about_open: bool,
    last_autosave: Instant,
    pending_close_tab: Option<usize>,
    pending_exit: bool,
    allow_exit: bool,
    find_open: bool,
    find_query: String,
    replace_query: String,
    find_matches: Vec<FindMatch>,
    find_index: usize,
    find_scroll_pending: bool,
    textures: HashMap<u64, (String, TextureHandle)>,
    webdav_open: bool,
    webdav_url: String,
    webdav_username: String,
    webdav_password: String,
    _instance: Option<SingleInstance>,
    open_queue_dir: PathBuf,
    last_queue_poll: Instant,
    cloud_tx: Sender<CloudResult>,
    cloud_rx: Receiver<CloudResult>,
    cloud_inflight: bool,
    cloud_hashes: HashMap<u64, u64>,
    last_cloud_check: Instant,
    cloud_status: String,
    ribbon_tab: RibbonTab,
    show_ruler: bool,
    sidebar_visible: bool,
    page_count: usize,
    scroll_to_page: Option<usize>,
    zoom: f32,
}

impl NativeApp {
    pub fn new(context: &eframe::CreationContext<'_>) -> Self {
        install_chinese_fonts(&context.egui_ctx);
        configure_style(&context.egui_ctx);
        let settings = config::load();
        let webdav_url = settings.webdav_url.clone();
        let webdav_username = settings.webdav_username.clone();
        let cloud_status = if webdav_url.trim().is_empty() {
            "云盘未配置".to_string()
        } else {
            "云盘已配置".to_string()
        };
        let args: Vec<String> = std::env::args().skip(1).collect();
        let lwd_args: Vec<String> = args
            .iter()
            .filter(|arg| {
                Path::new(arg)
                    .extension()
                    .and_then(|value| value.to_str())
                    .is_some_and(|value| value.eq_ignore_ascii_case("lwd"))
            })
            .cloned()
            .collect();
        let instance = SingleInstance::new("qingwen-native-lwd").ok();
        if instance.as_ref().is_some_and(|instance| !instance.is_single()) {
            let _ = queue_open_requests(&lwd_args);
            std::process::exit(0);
        }
        let open_queue_dir = open_queue_dir();
        let _ = fs::create_dir_all(&open_queue_dir);
        let (cloud_tx, cloud_rx) = mpsc::channel();
        let mut app = Self {
            tabs: Vec::new(),
            active: 0,
            next_tab_id: 1,
            next_block_id: 1,
            settings,
            status: "就绪".to_string(),
            selection: None,
            focus_block: None,
            pending_format: None,
            page_setup_open: false,
            about_open: false,
            last_autosave: Instant::now(),
            pending_close_tab: None,
            pending_exit: false,
            allow_exit: false,
            find_open: false,
            find_query: String::new(),
            replace_query: String::new(),
            find_matches: Vec::new(),
            find_index: 0,
            find_scroll_pending: false,
            textures: HashMap::new(),
            webdav_open: false,
            webdav_url,
            webdav_username,
            webdav_password: String::new(),
            _instance: instance,
            open_queue_dir,
            last_queue_poll: Instant::now(),
            cloud_tx,
            cloud_rx,
            cloud_inflight: false,
            cloud_hashes: HashMap::new(),
            last_cloud_check: Instant::now(),
            cloud_status,
            ribbon_tab: RibbonTab::Home,
            show_ruler: true,
            sidebar_visible: true,
            page_count: 1,
            scroll_to_page: None,
            zoom: 1.0,
        };
        app.new_tab();
        for path in lwd_args {
            let path = PathBuf::from(path);
            if path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("lwd"))
            {
                app.open_file(path);
            }
        }
        for tab in &mut app.tabs {
            app.next_block_id = app
                .next_block_id
                .max(tab.document.blocks.iter().map(|block| block.id + 1).max().unwrap_or(1));
        }
        app
    }

    fn active_tab(&self) -> Option<&Tab> {
        self.tabs.get(self.active)
    }

    fn active_tab_mut(&mut self) -> Option<&mut Tab> {
        self.tabs.get_mut(self.active)
    }

    fn new_block_id(&mut self) -> u64 {
        let id = self.next_block_id;
        self.next_block_id += 1;
        id
    }

    fn new_tab(&mut self) {
        let layout = self
            .active_tab()
            .map(|tab| tab.document.layout.clone())
            .unwrap_or_default();
        let block_id = self.new_block_id();
        let id = self.next_tab_id;
        self.next_tab_id += 1;
        self.tabs.push(Tab::blank(id, block_id, layout));
        self.active = self.tabs.len() - 1;
        self.selection = None;
        self.focus_block = None;
    }

    fn close_tab(&mut self, index: usize) {
        if self.tabs.len() <= 1 {
            self.new_tab();
        }
        if index < self.tabs.len() {
            self.tabs.remove(index);
        }
        if self.active >= self.tabs.len() {
            self.active = self.tabs.len().saturating_sub(1);
        }
        if self.tabs.is_empty() {
            self.new_tab();
        }
        self.selection = None;
        self.focus_block = None;
    }

    fn poll_open_requests(&mut self, ctx: &egui::Context) {
        if self.last_queue_poll.elapsed() < Duration::from_millis(500) {
            return;
        }
        self.last_queue_poll = Instant::now();
        let Ok(entries) = fs::read_dir(&self.open_queue_dir) else {
            return;
        };
        let mut paths = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Ok(request) = fs::read_to_string(&path) {
                paths.push(request.trim().to_string());
            }
            let _ = fs::remove_file(&path);
        }
        if paths.is_empty() {
            return;
        }
        for path in paths {
            if path.is_empty() {
                ctx.send_viewport_cmd(egui::ViewportCommand::Focus);
            } else {
                self.open_file(PathBuf::from(path));
                ctx.send_viewport_cmd(egui::ViewportCommand::Focus);
            }
        }
    }

    fn request_close_tab(&mut self, index: usize) {
        if self.tabs.get(index).is_some_and(|tab| tab.dirty) {
            self.pending_close_tab = Some(index);
        } else {
            self.close_tab(index);
        }
    }

    fn undo(&mut self) {
        if self.active_tab_mut().is_some_and(|tab| tab.undo()) {
            self.selection = None;
            self.focus_block = None;
            self.status = "已撤销".to_string();
        }
    }

    fn redo(&mut self) {
        if self.active_tab_mut().is_some_and(|tab| tab.redo()) {
            self.selection = None;
            self.focus_block = None;
            self.status = "已重做".to_string();
        }
    }

    fn save_all_dirty(&mut self) -> bool {
        let indices: Vec<usize> = self
            .tabs
            .iter()
            .enumerate()
            .filter(|(_, tab)| tab.dirty)
            .map(|(index, _)| index)
            .collect();
        for index in indices {
            self.active = index;
            if !self.save_dialog(false) {
                return false;
            }
        }
        true
    }

    fn has_dirty_tabs(&self) -> bool {
        self.tabs.iter().any(|tab| tab.dirty)
    }

    fn open_dialog(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("轻文文档", &["lwd"])
            .set_title("打开轻文文档")
            .pick_file()
        {
            self.open_file(path);
        }
    }

    fn open_file(&mut self, path: PathBuf) {
        match lwd::read_lwd(&path) {
            Ok(loaded) => self.open_loaded(loaded, Some(path), false),
            Err(error) => self.status = error,
        }
    }

    fn save_dialog(&mut self, save_as: bool) -> bool {
        let Some(tab) = self.active_tab() else {
            return false;
        };
        let path = if !save_as {
            tab.path.clone()
        } else {
            None
        };
        let path = path.or_else(|| {
            self.settings
                .default_save_dir
                .as_ref()
                .map(|dir| unique_document_path(dir, &tab.title))
        });
        let path = path.or_else(|| {
            let suggested = format!("{}.lwd", sanitize_stem(&tab.title));
            rfd::FileDialog::new()
                .add_filter("轻文文档", &["lwd"])
                .set_file_name(suggested)
                .set_title("保存轻文文档")
                .save_file()
        });
        let Some(path) = path else {
            return false;
        };
        let path = if path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("lwd"))
        {
            path
        } else {
            path.with_extension("lwd")
        };
        self.save_tab_path(self.active, path)
    }

    fn save_tab_path(&mut self, index: usize, path: PathBuf) -> bool {
        let Some(tab) = self.tabs.get_mut(index) else {
            return false;
        };
        match lwd::save_lwd(&path, &tab.document, &tab.title, &tab.created_at) {
            Ok(updated_at) => {
                tab.path = Some(path.clone());
                tab.updated_at = Some(updated_at);
                tab.dirty = false;
                tab.error = None;
                if tab.title == "未命名文档" {
                    tab.title = title_from_path(&path);
                }
                self.status = format!("已保存到 {}", path.display());
                true
            }
            Err(error) => {
                tab.error = Some(error.clone());
                self.status = error;
                false
            }
        }
    }

    fn autosave(&mut self) {
        let seconds = self.settings.autosave_seconds;
        if seconds == 0 || self.last_autosave.elapsed() < Duration::from_secs(seconds) {
            return;
        }
        self.last_autosave = Instant::now();
        let default_dir = self.settings.default_save_dir.clone();
        let mut changed = false;
        for index in 0..self.tabs.len() {
            if !self.tabs[index].dirty {
                continue;
            }
            let path = self.tabs[index].path.clone().or_else(|| {
                default_dir.as_ref().map(|dir| {
                    unique_document_path(dir, &self.tabs[index].title)
                })
            });
            if let Some(path) = path {
                changed |= self.save_tab_path(index, path);
            }
        }
        if changed {
            self.status = "自动保存完成".to_string();
        }
    }

    fn close_current_tab(&mut self) {
        let index = self.active;
        self.request_close_tab(index);
    }

    fn save_settings(&mut self) {
        config::save(&self.settings);
    }

    fn choose_default_dir(&mut self) {
        if let Some(dir) = rfd::FileDialog::new()
            .set_title("选择默认保存文件夹")
            .pick_folder()
        {
            self.settings.default_save_dir = Some(dir);
            self.save_settings();
            self.status = "默认保存文件夹已更新".to_string();
        }
    }

    fn apply_pending_format(&mut self) {
        let Some(action) = self.pending_format.take() else {
            return;
        };
        let Some((block_id, start, end)) = self.selection else {
            self.status = "请先在正文中选择文字".to_string();
            return;
        };
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let Some(block) = tab.document.blocks.iter_mut().find(|block| block.id == block_id) else {
            return;
        };
        if !block.kind.is_editable() || start >= end {
            return;
        }
        match action {
            MarkAction::Bold => apply_marks(block, start, end, |marks| marks.bold = true),
            MarkAction::Italic => apply_marks(block, start, end, |marks| marks.italic = true),
            MarkAction::Underline => apply_marks(block, start, end, |marks| marks.underline = true),
            MarkAction::Strike => apply_marks(block, start, end, |marks| marks.strike = true),
            MarkAction::Code => apply_marks(block, start, end, |marks| marks.code = true),
            MarkAction::Highlight => apply_marks(block, start, end, |marks| marks.highlight = true),
            MarkAction::Clear => apply_marks(block, start, end, |marks| *marks = Marks::default()),
        }
        tab.push_undo(snapshot);
        tab.dirty = true;
        self.status = "格式已应用".to_string();
    }

    fn change_block_kind(&mut self, kind: BlockKind) {
        let Some(block_id) = self.focus_block else {
            return;
        };
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let Some(block) = tab.document.blocks.iter_mut().find(|block| block.id == block_id) else {
            return;
        };
        if matches!(block.kind, BlockKind::Raw(_)) {
            return;
        }
        block.kind = kind;
        tab.push_undo(snapshot);
        tab.dirty = true;
    }

    fn insert_block_after(&mut self, block_id: u64) {
        let new_id = self.new_block_id();
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let position = tab
            .document
            .blocks
            .iter()
            .position(|block| block.id == block_id)
            .map(|index| index + 1)
            .unwrap_or(tab.document.blocks.len());
        tab.document.blocks.insert(
            position,
            Block::new(new_id, BlockKind::Paragraph, String::new()),
        );
        tab.push_undo(snapshot);
        tab.dirty = true;
        self.focus_block = Some(new_id);
        self.selection = None;
    }

    fn delete_block(&mut self, block_id: u64) {
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        if tab.document.blocks.len() <= 1 {
            return;
        }
        let snapshot = tab.document.clone();
        tab.document.blocks.retain(|block| block.id != block_id);
        tab.push_undo(snapshot);
        tab.dirty = true;
        self.selection = None;
        self.focus_block = None;
    }

    fn refresh_find_matches(&mut self) {
        self.find_matches.clear();
        let query = self.find_query.trim().to_lowercase();
        if query.is_empty() {
            self.find_index = 0;
            return;
        }
        let Some(tab) = self.active_tab() else {
            return;
        };
        let mut matches = Vec::new();
        for block in &tab.document.blocks {
            if !block.kind.is_editable() {
                continue;
            }
            let lower = block.text.to_lowercase();
            for (start, found) in lower.match_indices(&query) {
                let end = start + found.len();
                if block.text.is_char_boundary(start) && block.text.is_char_boundary(end) {
                    matches.push(FindMatch {
                        block_id: block.id,
                        start,
                        end,
                    });
                }
            }
        }
        self.find_matches = matches;
        if self.find_matches.is_empty() {
            self.find_index = 0;
        } else {
            self.find_index = self.find_index.min(self.find_matches.len() - 1);
        }
    }

    fn find_step(&mut self, forward: bool) {
        self.refresh_find_matches();
        if self.find_matches.is_empty() {
            self.status = "没有找到匹配项".to_string();
            return;
        }
        if forward {
            self.find_index = (self.find_index + 1) % self.find_matches.len();
        } else {
            self.find_index = (self.find_index + self.find_matches.len() - 1)
                % self.find_matches.len();
        }
        self.find_scroll_pending = true;
        self.status = format!(
            "匹配 {}/{}",
            self.find_index + 1,
            self.find_matches.len()
        );
    }

    fn replace_current(&mut self) {
        self.refresh_find_matches();
        let Some(found) = self.find_matches.get(self.find_index).copied() else {
            self.status = "没有找到匹配项".to_string();
            return;
        };
        let replacement = self.replace_query.clone();
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let Some(block) = tab
            .document
            .blocks
            .iter_mut()
            .find(|block| block.id == found.block_id)
        else {
            return;
        };
        let old_text = block.text.clone();
        block.text.replace_range(found.start..found.end, &replacement);
        adjust_marks_after_edit(block, &old_text);
        tab.push_undo(snapshot);
        tab.dirty = true;
        self.refresh_find_matches();
        self.find_scroll_pending = true;
        self.status = "已替换当前匹配".to_string();
    }

    fn replace_all(&mut self) {
        let query = self.find_query.trim().to_lowercase();
        if query.is_empty() {
            return;
        }
        let replacement = self.replace_query.clone();
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let mut replaced = 0usize;
        for block in &mut tab.document.blocks {
            if !block.kind.is_editable() {
                continue;
            }
            let old_text = block.text.clone();
            let lower = old_text.to_lowercase();
            let ranges: Vec<(usize, usize)> = lower
                .match_indices(&query)
                .filter_map(|(start, found)| {
                    let end = start + found.len();
                    (old_text.is_char_boundary(start) && old_text.is_char_boundary(end))
                        .then_some((start, end))
                })
                .collect();
            if ranges.is_empty() {
                continue;
            }
            for (start, end) in ranges.into_iter().rev() {
                block.text.replace_range(start..end, &replacement);
                replaced += 1;
            }
            adjust_marks_after_edit(block, &old_text);
        }
        if replaced > 0 {
            tab.push_undo(snapshot);
            tab.dirty = true;
            self.status = format!("已替换 {replaced} 处");
        } else {
            self.status = "没有找到匹配项".to_string();
        }
        self.refresh_find_matches();
        self.find_scroll_pending = true;
    }

    fn ensure_images(&mut self, ctx: &egui::Context) {
        let active = self.active;
        let Some(tab) = self.tabs.get(active) else {
            return;
        };
        let images: Vec<(u64, String)> = tab
            .document
            .blocks
            .iter()
            .filter(|block| matches!(block.kind, BlockKind::Image))
            .filter_map(|block| {
                let src = block.raw.as_ref()?.get("attrs")?.get("src")?.as_str()?;
                Some((block.id, src.to_string()))
            })
            .collect();
        for (id, src) in images {
            if self
                .textures
                .get(&id)
                .is_some_and(|(cached, _)| cached == &src)
            {
                continue;
            }
            if let Some(texture) = load_data_url_texture(ctx, id, &src) {
                self.textures.insert(id, (src, texture));
            }
        }
    }

    fn insert_image_dialog(&mut self) {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("图片", &["png", "jpg", "jpeg", "gif", "webp"])
            .set_title("插入图片")
            .pick_file()
        else {
            return;
        };
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) => {
                self.status = format!("读取图片失败：{error}");
                return;
            }
        };
        if bytes.len() > 30 * 1024 * 1024 {
            self.status = "图片超过 30 MB，暂不插入".to_string();
            return;
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("png")
            .to_ascii_lowercase();
        let mime = match extension.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "image/png",
        };
        let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let src = format!("data:{mime};base64,{encoded}");
        let alt = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("图片")
            .to_string();
        let raw = json!({
            "type": "image",
            "attrs": { "src": src, "alt": alt, "title": alt },
        });
        let block = Block {
            id: 0,
            kind: BlockKind::Image,
            text: String::new(),
            marks: Vec::new(),
            raw: Some(raw),
            table: None,
        };
        let new_id = self.new_block_id();
        let focus = self.focus_block;
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let position = focus
            .and_then(|focus| {
                tab.document
                    .blocks
                    .iter()
                    .position(|candidate| candidate.id == focus)
                    .map(|index| index + 1)
            })
            .unwrap_or(tab.document.blocks.len());
        let mut block = block;
        block.id = new_id;
        tab.document.blocks.insert(position, block);
        tab.push_undo(snapshot);
        tab.dirty = true;
        self.focus_block = Some(new_id);
        self.selection = None;
        self.status = "图片已插入；保存时会内嵌到 .lwd".to_string();
    }

    fn start_cloud_upload(&mut self, manual: bool) {
        if self.settings.webdav_url.trim().is_empty() {
            if manual {
                self.status = "请先设置 WebDAV URL".to_string();
                self.open_webdav_settings();
            }
            return;
        }
        if self.cloud_inflight {
            if manual {
                self.status = "云盘正在上传，请稍候".to_string();
            }
            return;
        }
        let Some(tab) = self.active_tab() else {
            return;
        };
        let filename = format!("{}.lwd", sanitize_stem(&tab.title));
        let (bytes, _) = match lwd::serialize_lwd(&tab.document, &tab.title, &tab.created_at) {
            Ok(value) => value,
            Err(error) => {
                self.status = error;
                return;
            }
        };
        let hash = lwd::content_hash(&tab.document, &tab.title);
        if !manual && self.cloud_hashes.get(&tab.id) == Some(&hash) {
            return;
        }
        let url = self.settings.webdav_url.clone();
        let tab_id = tab.id;
        let sender = self.cloud_tx.clone();
        self.cloud_inflight = true;
        self.cloud_status = "云盘上传中…".to_string();
        std::thread::spawn(move || {
            let result = webdav::upload(&url, &filename, &bytes);
            let _ = sender.send(CloudResult {
                tab_id,
                hash,
                result,
            });
        });
    }

    fn poll_cloud(&mut self) {
        while let Ok(result) = self.cloud_rx.try_recv() {
            self.cloud_inflight = false;
            match result.result {
                Ok(()) => {
                    self.cloud_hashes.insert(result.tab_id, result.hash);
                    self.cloud_status = "云盘已同步".to_string();
                    self.status = "WebDAV 上传完成".to_string();
                }
                Err(error) => {
                    self.cloud_status = format!("云盘失败：{error}");
                    self.status = format!("WebDAV 上传失败：{error}");
                }
            }
        }
    }

    fn cloud_tick(&mut self) {
        let seconds = self.settings.auto_cloud_seconds;
        if seconds == 0 || self.cloud_inflight {
            return;
        }
        if self.settings.webdav_url.trim().is_empty() {
            return;
        }
        if self.last_cloud_check.elapsed() < Duration::from_secs(seconds) {
            return;
        }
        self.last_cloud_check = Instant::now();
        self.start_cloud_upload(false);
    }

    fn print_active(&mut self) {
        let Some(tab) = self.active_tab() else {
            return;
        };
        let path = std::env::temp_dir().join(format!(
            "qingwen-print-{}.pdf",
            chrono::Utc::now().timestamp_millis()
        ));
        if let Err(error) = pdf::export_pdf(&path, &tab.title, &tab.document, &tab.document.layout) {
            self.status = format!("打印准备失败：{error}");
            return;
        }
        let result = if cfg!(target_os = "windows") {
            let escaped = path.to_string_lossy().replace('\'', "''");
            std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &format!("Start-Process -FilePath '{escaped}' -Verb Print"),
                ])
                .spawn()
        } else {
            std::process::Command::new("lp").arg(&path).spawn()
        };
        match result {
            Ok(_) => self.status = "已发送到系统打印".to_string(),
            Err(error) => self.status = format!("调用系统打印失败：{error}"),
        }
    }

    fn export_pdf_dialog(&mut self) {
        let Some(tab) = self.active_tab() else {
            return;
        };
        let suggested = format!("{}.pdf", sanitize_stem(&tab.title));
        let Some(path) = rfd::FileDialog::new()
            .add_filter("PDF", &["pdf"])
            .set_file_name(suggested)
            .set_title("导出 PDF")
            .save_file()
        else {
            return;
        };
        match pdf::export_pdf(&path, &tab.title, &tab.document, &tab.document.layout) {
            Ok(message) => self.status = message,
            Err(error) => self.status = format!("导出 PDF 失败：{error}"),
        }
    }

    fn open_webdav_settings(&mut self) {
        self.webdav_url = self.settings.webdav_url.clone();
        self.webdav_username = self.settings.webdav_username.clone();
        self.webdav_password.clear();
        if let Some(credentials) = webdav::load_credentials() {
            if self.webdav_username.is_empty() {
                self.webdav_username = credentials.username;
            }
            self.webdav_password = credentials.password;
        }
        self.webdav_open = true;
    }

    fn save_webdav_settings(&mut self) {
        let url = self.webdav_url.trim().to_string();
        if !url.is_empty() {
            if let Err(error) = webdav::normalize_base_url(&url) {
                self.status = error;
                return;
            }
        }
        self.settings.webdav_url = url;
        self.settings.webdav_username = self.webdav_username.trim().to_string();
        if !self.webdav_password.is_empty() {
            if let Err(error) = webdav::save_credentials(&webdav::Credentials {
                username: self.settings.webdav_username.clone(),
                password: self.webdav_password.clone(),
            }) {
                self.status = error;
                return;
            }
        }
        self.save_settings();
        self.webdav_open = false;
        self.last_cloud_check = Instant::now();
        self.cloud_status = if self.settings.webdav_url.trim().is_empty() {
            "云盘未配置".to_string()
        } else {
            "云盘已配置".to_string()
        };
        self.status = "WebDAV 设置已保存".to_string();
    }

    fn webdav_upload(&mut self) {
        self.start_cloud_upload(true);
    }

    fn webdav_download(&mut self) {
        if self.settings.webdav_url.trim().is_empty() {
            self.status = "请先设置 WebDAV URL".to_string();
            self.open_webdav_settings();
            return;
        }
        let filename = self
            .active_tab()
            .map(|tab| format!("{}.lwd", sanitize_stem(&tab.title)))
            .unwrap_or_else(|| "未命名文档.lwd".to_string());
        match webdav::download(&self.settings.webdav_url, &filename) {
            Ok(bytes) => match lwd::read_lwd_bytes(&bytes, &filename) {
                Ok(loaded) => {
                    self.open_loaded(loaded, None, true);
                    self.status = format!("已从 WebDAV 下载 {filename}");
                }
                Err(error) => self.status = format!("远程文件不是有效 .lwd：{error}"),
            },
            Err(error) => self.status = format!("下载失败：{error}"),
        }
    }

    fn open_loaded(&mut self, loaded: lwd::LoadedLwd, path: Option<PathBuf>, dirty: bool) {
        let block_id = self.new_block_id();
        let id = self.next_tab_id;
        self.next_tab_id += 1;
        let mut document = loaded.document;
        if document.blocks.is_empty() {
            document
                .blocks
                .push(Block::new(block_id, BlockKind::Paragraph, String::new()));
        }
        for (index, block) in document.blocks.iter_mut().enumerate() {
            block.id = block_id + index as u64;
        }
        self.next_block_id = self
            .next_block_id
            .max(document.blocks.iter().map(|block| block.id + 1).max().unwrap_or(1));
        let tab = Tab {
            id,
            title: loaded.title,
            path,
            document,
            dirty,
            created_at: loaded.created_at,
            updated_at: Some(loaded.updated_at),
            error: None,
            undo: Vec::new(),
            redo: Vec::new(),
        };
        let reuse_initial = self.tabs.len() == 1
            && self.tabs[0].path.is_none()
            && !self.tabs[0].dirty
            && self.tabs[0].document.blocks.len() == 1
            && self.tabs[0].document.blocks[0].text.trim().is_empty();
        if reuse_initial {
            self.tabs[0] = tab;
            self.active = 0;
        } else {
            self.tabs.push(tab);
            self.active = self.tabs.len() - 1;
        }
        self.status = "已打开文档".to_string();
    }

    fn insert_table(&mut self) {
        let mut table = TableData {
            header: true,
            rows: vec![vec![TableCell::default(); 3]; 3],
        };
        table.rows[0][0].text = "表头".to_string();
        let block = Block {
            id: 0,
            kind: BlockKind::Table,
            text: String::new(),
            marks: Vec::new(),
            raw: None,
            table: Some(table),
        };
        let new_id = self.new_block_id();
        let focus = self.focus_block;
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let position = focus
            .and_then(|focus| {
                tab.document
                    .blocks
                    .iter()
                    .position(|candidate| candidate.id == focus)
                    .map(|index| index + 1)
            })
            .unwrap_or(tab.document.blocks.len());
        let mut block = block;
        block.id = new_id;
        tab.document.blocks.insert(position, block);
        tab.push_undo(snapshot);
        tab.dirty = true;
        self.focus_block = Some(new_id);
        self.selection = None;
        self.status = "3×3 表格已插入".to_string();
    }

    fn toolbar(&mut self, ui: &mut Ui) {
        ui.horizontal_wrapped(|ui| {
            if ui.button("新建").clicked() {
                self.new_tab();
            }
            if ui.button("打开").clicked() {
                self.open_dialog();
            }
            if ui.button("保存").clicked() {
                self.save_dialog(false);
            }
            if ui.button("PDF").clicked() {
                self.export_pdf_dialog();
            }
            if ui.button("打印").clicked() {
                self.print_active();
            }
            let can_undo = self.active_tab().is_some_and(|tab| !tab.undo.is_empty());
            let can_redo = self.active_tab().is_some_and(|tab| !tab.redo.is_empty());
            if ui.add_enabled(can_undo, egui::Button::new("撤销")).clicked() {
                self.undo();
            }
            if ui.add_enabled(can_redo, egui::Button::new("重做")).clicked() {
                self.redo();
            }
            if ui.button("查找").clicked() {
                self.find_open = true;
                self.refresh_find_matches();
            }
            ui.separator();
            let enabled = self.selection.is_some_and(|(_, start, end)| start < end);
            if ui
                .add_enabled(enabled, egui::Button::new("B"))
                .on_hover_text("加粗")
                .clicked()
            {
                self.pending_format = Some(MarkAction::Bold);
            }
            if ui
                .add_enabled(enabled, egui::Button::new("I"))
                .on_hover_text("斜体")
                .clicked()
            {
                self.pending_format = Some(MarkAction::Italic);
            }
            if ui
                .add_enabled(enabled, egui::Button::new("U"))
                .on_hover_text("下划线")
                .clicked()
            {
                self.pending_format = Some(MarkAction::Underline);
            }
            if ui
                .add_enabled(enabled, egui::Button::new("S"))
                .on_hover_text("删除线")
                .clicked()
            {
                self.pending_format = Some(MarkAction::Strike);
            }
            if ui
                .add_enabled(enabled, egui::Button::new("</>"))
                .on_hover_text("行内代码")
                .clicked()
            {
                self.pending_format = Some(MarkAction::Code);
            }
            if ui
                .add_enabled(enabled, egui::Button::new("高亮"))
                .clicked()
            {
                self.pending_format = Some(MarkAction::Highlight);
            }
            if ui
                .add_enabled(enabled, egui::Button::new("清除格式"))
                .clicked()
            {
                self.pending_format = Some(MarkAction::Clear);
            }
            ui.separator();
            let current = self
                .focus_block
                .and_then(|id| {
                    self.active_tab()
                        .and_then(|tab| tab.document.blocks.iter().find(|block| block.id == id))
                })
                .map(|block| block.kind.label())
                .unwrap_or("段落");
            egui::ComboBox::from_id_salt("native-block-kind")
                .selected_text(current)
                .show_ui(ui, |ui| {
                    if ui.selectable_label(current == "正文", "正文").clicked() {
                        self.change_block_kind(BlockKind::Paragraph);
                    }
                    if ui.selectable_label(current == "标题 1", "标题 1").clicked() {
                        self.change_block_kind(BlockKind::Heading(1));
                    }
                    if ui.selectable_label(current == "标题 2", "标题 2").clicked() {
                        self.change_block_kind(BlockKind::Heading(2));
                    }
                    if ui.selectable_label(current == "标题 3", "标题 3").clicked() {
                        self.change_block_kind(BlockKind::Heading(3));
                    }
                    if ui.selectable_label(current == "项目符号", "项目符号").clicked() {
                        self.change_block_kind(BlockKind::Bullet);
                    }
                    if ui.selectable_label(current == "编号列表", "编号列表").clicked() {
                        self.change_block_kind(BlockKind::Ordered);
                    }
                    if ui.selectable_label(current == "引用", "引用").clicked() {
                        self.change_block_kind(BlockKind::Quote);
                    }
                    if ui.selectable_label(current == "代码块", "代码块").clicked() {
                        self.change_block_kind(BlockKind::Code);
                    }
                });
            if ui.button("图片").clicked() {
                self.insert_image_dialog();
            }
            if ui.button("表格").clicked() {
                self.insert_table();
            }
            if ui.button("页面设置").clicked() {
                self.page_setup_open = true;
            }
            ui.separator();
            if ui.button("＋ 段落").clicked() {
                let id = self
                    .focus_block
                    .or_else(|| self.active_tab().and_then(|tab| tab.document.blocks.last().map(|block| block.id)));
                if let Some(id) = id {
                    self.insert_block_after(id);
                }
            }
        });

        if self.find_open {
            ui.horizontal_wrapped(|ui| {
                ui.label("查找");
                let changed = ui
                    .add(
                        TextEdit::singleline(&mut self.find_query)
                            .desired_width(170.0)
                            .hint_text("查找内容"),
                    )
                    .changed();
                if changed {
                    self.find_index = 0;
                    self.refresh_find_matches();
                }
                let count = self.find_matches.len();
                ui.label(format!(
                    "{}/{}",
                    if count == 0 { 0 } else { self.find_index + 1 },
                    count
                ));
                if ui.button("上一个").clicked() {
                    self.find_step(false);
                }
                if ui.button("下一个").clicked() {
                    self.find_step(true);
                }
                ui.separator();
                ui.label("替换为");
                ui.add(
                    TextEdit::singleline(&mut self.replace_query)
                        .desired_width(170.0)
                        .hint_text("替换内容"),
                );
                if ui.button("替换").clicked() {
                    self.replace_current();
                }
                if ui.button("全部替换").clicked() {
                    self.replace_all();
                }
                if ui.button("关闭").clicked() {
                    self.find_open = false;
                }
            });
        }
    }

    fn ribbon(&mut self, ui: &mut Ui) {
        ui.horizontal(|ui| {
            ui.menu_button("文件", |ui| {
                if ui.button("新建标签页    Ctrl+N").clicked() {
                    self.new_tab();
                    ui.close_menu();
                }
                if ui.button("打开…    Ctrl+O").clicked() {
                    self.open_dialog();
                    ui.close_menu();
                }
                if ui.button("保存    Ctrl+S").clicked() {
                    self.save_dialog(false);
                    ui.close_menu();
                }
                if ui.button("另存为…    Ctrl+Shift+S").clicked() {
                    self.save_dialog(true);
                    ui.close_menu();
                }
                if ui.button("导出 PDF…").clicked() {
                    self.export_pdf_dialog();
                    ui.close_menu();
                }
                if ui.button("打印…").clicked() {
                    self.print_active();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("退出").clicked() {
                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });
            ui.menu_button("设置", |ui| {
                if ui.button("选择默认保存文件夹…").clicked() {
                    self.choose_default_dir();
                    ui.close_menu();
                }
                if ui.button("关闭默认保存文件夹").clicked() {
                    self.settings.default_save_dir = None;
                    self.save_settings();
                    ui.close_menu();
                }
                ui.separator();
                ui.label("自动保存间隔");
                for seconds in [0_u64, 30, 60, 120, 300] {
                    let label = if seconds == 0 {
                        "关闭".to_string()
                    } else {
                        format!("{seconds} 秒")
                    };
                    if ui
                        .selectable_label(self.settings.autosave_seconds == seconds, label)
                        .clicked()
                    {
                        self.settings.autosave_seconds = seconds;
                        self.save_settings();
                    }
                }
                if ui.button("关于轻文 Native").clicked() {
                    self.about_open = true;
                    ui.close_menu();
                }
            });
            ui.menu_button("云端", |ui| {
                if ui.button("WebDAV 设置…").clicked() {
                    self.open_webdav_settings();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("上传当前文档").clicked() {
                    self.webdav_upload();
                    ui.close_menu();
                }
                if ui.button("从 WebDAV 下载").clicked() {
                    self.webdav_download();
                    ui.close_menu();
                }
            });
            let title = self
                .active_tab()
                .map(|tab| tab.title.as_str())
                .unwrap_or("未命名文档");
            ui.label(RichText::new(title).strong());
            if self.active_tab().is_some_and(|tab| tab.dirty) {
                ui.label(RichText::new("● 未保存").color(Color32::from_rgb(200, 120, 20)));
            }
            ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                if ui.button("保存").clicked() {
                    self.save_dialog(false);
                }
                if ui
                    .add_enabled(
                        self.active_tab().is_some_and(|tab| !tab.redo.is_empty()),
                        egui::Button::new("重做"),
                    )
                    .clicked()
                {
                    self.redo();
                }
                if ui
                    .add_enabled(
                        self.active_tab().is_some_and(|tab| !tab.undo.is_empty()),
                        egui::Button::new("撤销"),
                    )
                    .clicked()
                {
                    self.undo();
                }
            });
        });
        ui.separator();
        ui.horizontal(|ui| {
            for (tab, label) in [
                (RibbonTab::Home, "开始"),
                (RibbonTab::Insert, "插入"),
                (RibbonTab::Layout, "布局"),
                (RibbonTab::Table, "表格"),
                (RibbonTab::View, "视图"),
            ] {
                if ui
                    .selectable_label(self.ribbon_tab == tab, RichText::new(label).strong())
                    .clicked()
                {
                    self.ribbon_tab = tab;
                }
            }
        });
        ui.separator();

        match self.ribbon_tab {
            RibbonTab::Home => {
                ui.horizontal_wrapped(|ui| {
                    ribbon_group(ui, "字体", |ui| {
                        let enabled = self.selection.is_some_and(|(_, start, end)| start < end);
                        for (label, action) in [
                            ("B", MarkAction::Bold),
                            ("I", MarkAction::Italic),
                            ("U", MarkAction::Underline),
                            ("S", MarkAction::Strike),
                            ("</>", MarkAction::Code),
                            ("高亮", MarkAction::Highlight),
                            ("清除格式", MarkAction::Clear),
                        ] {
                            if ui.add_enabled(enabled, egui::Button::new(label)).clicked() {
                                self.pending_format = Some(action);
                            }
                        }
                    });
                    ribbon_group(ui, "段落", |ui| {
                        self.block_kind_combo(ui);
                        if ui.button("• 列表").clicked() {
                            self.change_block_kind(BlockKind::Bullet);
                        }
                        if ui.button("1. 编号").clicked() {
                            self.change_block_kind(BlockKind::Ordered);
                        }
                        if ui.button("引用").clicked() {
                            self.change_block_kind(BlockKind::Quote);
                        }
                        if ui.button("代码").clicked() {
                            self.change_block_kind(BlockKind::Code);
                        }
                    });
                    ribbon_group(ui, "样式", |ui| {
                        for (label, kind, size) in [
                            ("正文", BlockKind::Paragraph, 14.0),
                            ("标题 1", BlockKind::Heading(1), 20.0),
                            ("标题 2", BlockKind::Heading(2), 17.0),
                            ("引用", BlockKind::Quote, 14.0),
                            ("代码", BlockKind::Code, 13.0),
                        ] {
                            if ui
                                .add(egui::Button::new(RichText::new(label).size(size)))
                                .clicked()
                            {
                                self.change_block_kind(kind);
                            }
                        }
                    });
                    ribbon_group(ui, "编辑", |ui| {
                        if ui.button("查找").clicked() {
                            self.find_open = true;
                            self.refresh_find_matches();
                        }
                        if ui.button("＋ 段落").clicked() {
                            let id = self.focus_block.or_else(|| {
                                self.active_tab().and_then(|tab| {
                                    tab.document.blocks.last().map(|block| block.id)
                                })
                            });
                            if let Some(id) = id {
                                self.insert_block_after(id);
                            }
                        }
                    });
                });
            }
            RibbonTab::Insert => {
                ui.horizontal_wrapped(|ui| {
                    ribbon_group(ui, "插入", |ui| {
                        if ui.button("图片").clicked() {
                            self.insert_image_dialog();
                        }
                        if ui.button("表格").clicked() {
                            self.insert_table();
                        }
                    });
                    ribbon_group(ui, "页面", |ui| {
                        if ui.button("分页符").clicked() {
                            self.insert_page_break();
                        }
                        if ui.button("页眉页脚").clicked() {
                            self.status = "页眉页脚将在后续版本加入".to_string();
                        }
                    });
                    ribbon_group(ui, "输出", |ui| {
                        if ui.button("PDF").clicked() {
                            self.export_pdf_dialog();
                        }
                        if ui.button("打印").clicked() {
                            self.print_active();
                        }
                    });
                });
            }
            RibbonTab::Layout => {
                ui.horizontal_wrapped(|ui| {
                    ribbon_group(ui, "页面", |ui| {
                        if ui.button("页面设置").clicked() {
                            self.page_setup_open = true;
                        }
                        ui.label("A4 · 21 × 29.7 cm");
                    });
                    ribbon_group(ui, "段落", |ui| {
                        if ui.button("首行缩进 +1").clicked() {
                            self.adjust_first_line_indent(1);
                        }
                        if ui.button("首行缩进 -1").clicked() {
                            self.adjust_first_line_indent(-1);
                        }
                    });
                });
            }
            RibbonTab::Table => {
                ui.horizontal_wrapped(|ui| {
                    ribbon_group(ui, "行列", |ui| {
                        if ui.button("＋ 行").clicked() {
                            self.table_action(TableAction::AddRow);
                        }
                        if ui.button("＋ 列").clicked() {
                            self.table_action(TableAction::AddColumn);
                        }
                        if ui.button("－ 行").clicked() {
                            self.table_action(TableAction::RemoveRow);
                        }
                        if ui.button("－ 列").clicked() {
                            self.table_action(TableAction::RemoveColumn);
                        }
                    });
                    ribbon_group(ui, "插入", |ui| {
                        if ui.button("3×3 表格").clicked() {
                            self.insert_table();
                        }
                    });
                    ui.label("选中表格后使用；单元格文字可直接编辑");
                });
            }
            RibbonTab::View => {
                ui.horizontal_wrapped(|ui| {
                    ribbon_group(ui, "显示", |ui| {
                        if ui.checkbox(&mut self.show_ruler, "显示标尺").changed() {
                            // 下一帧按新状态绘制
                        }
                        let mut sidebar = self.sidebar_open();
                        if ui.checkbox(&mut sidebar, "显示文档树").changed() {
                            self.set_sidebar_open(sidebar);
                        }
                    });
                    ribbon_group(ui, "窗口", |ui| {
                        ui.label("页面视图");
                        if ui.button("－").clicked() {
                            self.zoom = (self.zoom - 0.1).max(0.6);
                        }
                        if ui.button("100%").clicked() {
                            self.zoom = 1.0;
                        }
                        if ui.button("＋").clicked() {
                            self.zoom = (self.zoom + 0.1).min(2.0);
                        }
                        ui.label(format!("{:.0}%", self.zoom * 100.0));
                    });
                });
            }
        }

        if self.find_open {
            self.find_bar(ui);
        }
    }

    fn block_kind_combo(&mut self, ui: &mut Ui) {
        let current = self
            .focus_block
            .and_then(|id| {
                self.active_tab()
                    .and_then(|tab| tab.document.blocks.iter().find(|block| block.id == id))
            })
            .map(|block| block.kind.label())
            .unwrap_or("段落");
        egui::ComboBox::from_id_salt("ribbon-block-kind")
            .selected_text(current)
            .show_ui(ui, |ui| {
                for (label, kind) in [
                    ("正文", BlockKind::Paragraph),
                    ("标题 1", BlockKind::Heading(1)),
                    ("标题 2", BlockKind::Heading(2)),
                    ("标题 3", BlockKind::Heading(3)),
                    ("项目符号", BlockKind::Bullet),
                    ("编号列表", BlockKind::Ordered),
                    ("引用", BlockKind::Quote),
                    ("代码块", BlockKind::Code),
                ] {
                    if ui.selectable_label(current == label, label).clicked() {
                        self.change_block_kind(kind);
                    }
                }
            });
    }

    fn adjust_first_line_indent(&mut self, delta: i32) {
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let next = (tab.document.layout.first_line_indent as i32 + delta * 1).clamp(0, 4) as u32;
        if next != tab.document.layout.first_line_indent {
            tab.document.layout.first_line_indent = next;
            tab.dirty = true;
        }
    }

    fn insert_page_break(&mut self) {
        let id = self.new_block_id();
        let focus = self.focus_block;
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let position = focus
            .and_then(|focus| {
                tab.document
                    .blocks
                    .iter()
                    .position(|block| block.id == focus)
            })
            .map(|index| index + 1)
            .unwrap_or(tab.document.blocks.len());
        tab.document.blocks.insert(
            position,
            Block {
                id,
                kind: BlockKind::PageBreak,
                text: String::new(),
                marks: Vec::new(),
                raw: Some(serde_json::json!({ "type": "pageBreak" })),
                table: None,
            },
        );
        tab.dirty = true;
        self.status = "已插入分页符".to_string();
    }

    fn table_action(&mut self, action: TableAction) {
        let focus = self.focus_block;
        let Some(tab) = self.active_tab_mut() else {
            return;
        };
        let snapshot = tab.document.clone();
        let Some(block) = tab.document.blocks.iter_mut().find(|block| {
            matches!(block.kind, BlockKind::Table)
                && focus.map(|id| id == block.id).unwrap_or(true)
        }) else {
            self.status = "请先选中一个表格".to_string();
            return;
        };
        let Some(table) = block.table.as_mut() else {
            return;
        };
        match action {
            TableAction::AddRow => {
                let count = table.rows.iter().map(Vec::len).max().unwrap_or(1).max(1);
                table.rows.push(vec![TableCell::default(); count]);
            }
            TableAction::AddColumn => {
                for row in &mut table.rows {
                    row.push(TableCell::default());
                }
            }
            TableAction::RemoveRow => {
                if table.rows.len() > 1 {
                    table.rows.pop();
                }
            }
            TableAction::RemoveColumn => {
                if table.rows.iter().all(|row| row.len() > 1) {
                    for row in &mut table.rows {
                        row.pop();
                    }
                }
            }
        }
        tab.push_undo(snapshot);
        tab.dirty = true;
    }

    fn sidebar_open(&self) -> bool {
        self.sidebar_visible
    }

    fn set_sidebar_open(&mut self, open: bool) {
        self.sidebar_visible = open;
    }

    fn find_bar(&mut self, ui: &mut Ui) {
        ui.horizontal_wrapped(|ui| {
            ui.label("查找");
            let changed = ui
                .add(
                    TextEdit::singleline(&mut self.find_query)
                        .desired_width(170.0)
                        .hint_text("查找内容"),
                )
                .changed();
            if changed {
                self.find_index = 0;
                self.refresh_find_matches();
            }
            let count = self.find_matches.len();
            ui.label(format!(
                "{}/{}",
                if count == 0 { 0 } else { self.find_index + 1 },
                count
            ));
            if ui.button("上一个").clicked() {
                self.find_step(false);
            }
            if ui.button("下一个").clicked() {
                self.find_step(true);
            }
            ui.separator();
            ui.label("替换为");
            ui.add(
                TextEdit::singleline(&mut self.replace_query)
                    .desired_width(170.0)
                    .hint_text("替换内容"),
            );
            if ui.button("替换").clicked() {
                self.replace_current();
            }
            if ui.button("全部替换").clicked() {
                self.replace_all();
            }
            if ui.button("关闭").clicked() {
                self.find_open = false;
            }
        });
    }

    fn menu(&mut self, ui: &mut Ui) {
        egui::menu::bar(ui, |ui| {
            ui.menu_button("文件", |ui| {
                if ui.button("新建标签页    Ctrl+N").clicked() {
                    self.new_tab();
                    ui.close_menu();
                }
                if ui.button("打开…    Ctrl+O").clicked() {
                    self.open_dialog();
                    ui.close_menu();
                }
                if ui.button("保存    Ctrl+S").clicked() {
                    self.save_dialog(false);
                    ui.close_menu();
                }
                if ui.button("另存为…    Ctrl+Shift+S").clicked() {
                    self.save_dialog(true);
                    ui.close_menu();
                }
                if ui.button("导出 PDF…").clicked() {
                    self.export_pdf_dialog();
                    ui.close_menu();
                }
                if ui.button("打印…").clicked() {
                    self.print_active();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("退出").clicked() {
                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });
            ui.menu_button("设置", |ui| {
                if ui.button("选择默认保存文件夹…").clicked() {
                    self.choose_default_dir();
                    ui.close_menu();
                }
                if ui.button("关闭默认保存文件夹").clicked() {
                    self.settings.default_save_dir = None;
                    self.save_settings();
                    ui.close_menu();
                }
                ui.separator();
                ui.label("自动保存间隔");
                for seconds in [0_u64, 30, 60, 120, 300] {
                    let label = if seconds == 0 {
                        "关闭".to_string()
                    } else {
                        format!("{seconds} 秒")
                    };
                    if ui
                        .selectable_label(self.settings.autosave_seconds == seconds, label)
                        .clicked()
                    {
                        self.settings.autosave_seconds = seconds;
                        self.save_settings();
                    }
                }
                ui.separator();
                if ui.button("关于轻文 Native").clicked() {
                    self.about_open = true;
                    ui.close_menu();
                }
            });
            ui.menu_button("云端", |ui| {
                if ui.button("WebDAV 设置…").clicked() {
                    self.open_webdav_settings();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("上传当前文档").clicked() {
                    self.webdav_upload();
                    ui.close_menu();
                }
                if ui.button("从 WebDAV 下载").clicked() {
                    self.webdav_download();
                    ui.close_menu();
                }
            });
            ui.separator();
            let title = self
                .active_tab()
                .map(|tab| tab.title.as_str())
                .unwrap_or("未命名文档");
            ui.label(RichText::new(title).strong());
            if self.active_tab().is_some_and(|tab| tab.dirty) {
                ui.label(RichText::new("● 未保存").color(Color32::from_rgb(200, 120, 20)));
            }
        });
    }

    fn side_panel(&mut self, ctx: &egui::Context) {
        egui::SidePanel::left("native-tabs")
            .resizable(true)
            .default_width(190.0)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.heading("文档");
                    ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                        if ui.button("＋").on_hover_text("新建标签页").clicked() {
                            self.new_tab();
                        }
                    });
                });
                ui.separator();
                let mut select = None;
                let mut close = None;
                for (index, tab) in self.tabs.iter().enumerate() {
                    ui.horizontal(|ui| {
                        let label = if tab.dirty {
                            format!("● {}", tab.title)
                        } else {
                            tab.title.clone()
                        };
                        if ui
                            .selectable_label(index == self.active, label)
                            .clicked()
                        {
                            select = Some(index);
                        }
                        if ui.small_button("×").on_hover_text("关闭").clicked() {
                            close = Some(index);
                        }
                    });
                }
                if let Some(index) = select {
                    self.active = index;
                    self.selection = None;
                    self.focus_block = None;
                }
                if let Some(index) = close {
                    self.request_close_tab(index);
                }
                ui.with_layout(egui::Layout::bottom_up(Align::LEFT), |ui| {
                    if let Some(dir) = &self.settings.default_save_dir {
                        ui.label(
                            RichText::new(format!("默认目录：{}", dir.display()))
                                .small()
                                .color(Color32::GRAY),
                        );
                    } else {
                        ui.label(RichText::new("未设置默认保存目录").small().color(Color32::GRAY));
                    }
                });
            });
    }

    fn central_page(&mut self, ctx: &egui::Context) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ScrollArea::both()
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    ui.vertical_centered(|ui| {
                        let width = (PAGE_WIDTH * self.zoom)
                            .min((ui.available_width() - 32.0).max(420.0));
                        let scale = width / 21.0;
                        self.editor_pages(ui, width, scale);
                    });
                });
        });
    }

    fn editor_pages(&mut self, ui: &mut Ui, width: f32, scale: f32) {
        let active = self.active;
        let Some(tab) = self.tabs.get(active) else {
            return;
        };
        let mut layout = tab.document.layout.clone();
        let zoom = self.zoom;
        layout.font_size *= zoom;
        let left = (layout.margins.left * scale).min(width * 0.4);
        let right = (layout.margins.right * scale).min(width * 0.4);
        let top = (layout.margins.top * scale).min(width * 0.4);
        let bottom = (layout.margins.bottom * scale).min(width * 0.4);
        let content_width = (width - left - right).max(120.0);
        let page_height = (width * 297.0 / 210.0).max(900.0);
        let usable_height = (page_height - top - bottom - 18.0).max(120.0);
        let show_ruler = self.show_ruler;
        if show_ruler {
            draw_ruler(ui, width, left, right, scale);
            ui.add_space(4.0);
        }

        self.ensure_images(ui.ctx());
        let textures: HashMap<u64, TextureHandle> = self
            .textures
            .iter()
            .map(|(id, (_, texture))| (*id, texture.clone()))
            .collect();
        let find_ranges: Vec<(u64, usize, usize, bool)> = self
            .find_matches
            .iter()
            .enumerate()
            .map(|(index, found)| {
                (
                    found.block_id,
                    found.start,
                    found.end,
                    index == self.find_index,
                )
            })
            .collect();
        let find_active_block = self
            .find_matches
            .get(self.find_index)
            .map(|found| found.block_id);
        let scroll_pending = self.find_scroll_pending;

        if self.tabs[active].document.blocks.is_empty() {
            let id = self.new_block_id();
            self.tabs[active]
                .document
                .blocks
                .push(Block::new(id, BlockKind::Paragraph, String::new()));
        }

        let mut pages: Vec<Vec<usize>> = Vec::new();
        let mut current: Vec<usize> = Vec::new();
        let mut used = 0.0_f32;
        for (index, block) in self.tabs[active].document.blocks.iter().enumerate() {
            if matches!(block.kind, BlockKind::PageBreak) {
                if !current.is_empty() {
                    current.push(index);
                    pages.push(std::mem::take(&mut current));
                    used = 0.0;
                }
                continue;
            }
            let height = estimate_block_height(block, &layout, content_width, &textures);
            if !current.is_empty() && used + height > usable_height {
                pages.push(std::mem::take(&mut current));
                used = 0.0;
            }
            current.push(index);
            used += height;
            if used > usable_height {
                pages.push(std::mem::take(&mut current));
                used = 0.0;
            }
        }
        if !current.is_empty() {
            pages.push(current);
        }
        if pages.is_empty() {
            pages.push(Vec::new());
        }
        let page_count = pages.len();
        self.page_count = page_count;

        let frame_before = self.tabs[active].document.clone();
        let mut tab = self.tabs.get_mut(active).expect("active tab");
        let mut changed = false;
        let mut next_selection = self.selection;
        let mut next_focus = self.focus_block;
        let mut insert_after = None;
        let mut delete_block = None;
        let mut scroll_rect = None;

        let mut page_target_rect = None;
        for (page_index, indices) in pages.iter().enumerate() {
            let page_response = Frame::NONE
                .fill(Color32::WHITE)
                .stroke(Stroke::new(1.0_f32, Color32::from_rgb(226, 232, 240)))
                .shadow(egui::epaint::Shadow {
                    offset: [0, 8],
                    blur: 24,
                    spread: 0,
                    color: Color32::from_black_alpha(18),
                })
                .show(ui, |ui| {
                    ui.set_width(width);
                    ui.set_min_height(page_height);
                    draw_vertical_ruler(ui, page_height, top, bottom, scale);
                    if layout.header_text.is_empty() {
                        ui.add_space(top);
                    } else {
                        ui.add_space((top * 0.25).max(4.0));
                        ui.horizontal(|ui| {
                            ui.add_space(left);
                            ui.label(
                                RichText::new(&layout.header_text)
                                    .small()
                                    .color(Color32::from_gray(110)),
                            );
                            ui.add_space(right);
                        });
                        ui.add_space((top * 0.25).max(4.0));
                    }
                    ui.horizontal(|ui| {
                        ui.add_space(left);
                        ui.vertical(|ui| {
                            ui.set_width(content_width);
                            for &block_index in indices {
                                let block = &mut tab.document.blocks[block_index];
                                let result = render_one_block(
                                    ui,
                                    block,
                                    block_index,
                                    content_width,
                                    &layout,
                                    &find_ranges,
                                    &textures,
                                    scroll_pending,
                                    find_active_block,
                                );
                                changed |= result.changed;
                                if result.focus.is_some() {
                                    next_focus = result.focus;
                                }
                                if result.selection.is_some() {
                                    next_selection = result.selection;
                                }
                                if result.insert_after.is_some() {
                                    insert_after = result.insert_after;
                                }
                                if result.delete_block.is_some() {
                                    delete_block = result.delete_block;
                                }
                                if result.scroll_rect.is_some() {
                                    scroll_rect = result.scroll_rect;
                                }
                            }
                        });
                        ui.add_space(right);
                    });
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.add_space(left);
                        if !layout.footer_text.is_empty() {
                            ui.label(
                                RichText::new(&layout.footer_text)
                                    .small()
                                    .color(Color32::from_gray(110)),
                            );
                        }
                        ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                            ui.add_space(right);
                            ui.label(
                                RichText::new(format!(
                                    "第 {} 页 / 共 {} 页",
                                    page_index + 1,
                                    page_count
                                ))
                                .small()
                                .color(Color32::from_gray(110)),
                            );
                        });
                    });
                    ui.add_space((bottom * 0.25).max(4.0));
                });
            if self.scroll_to_page == Some(page_index) {
                page_target_rect = Some(page_response.response.rect);
            }
            if page_index + 1 < pages.len() {
                ui.add_space(22.0);
            }
        }

        if let Some(rect) = page_target_rect {
            ui.scroll_to_rect(rect, Some(egui::Align::TOP));
            self.scroll_to_page = None;
        }
        if changed {
            tab.push_undo(frame_before);
            tab.dirty = true;
        }
        self.selection = next_selection;
        self.focus_block = next_focus;
        if let Some(rect) = scroll_rect {
            ui.scroll_to_rect(rect, Some(egui::Align::Center));
            self.find_scroll_pending = false;
        }
        if let Some(id) = insert_after {
            self.insert_block_after(id);
        }
        if let Some(id) = delete_block {
            self.delete_block(id);
        }
    }

    fn status_bar(&mut self, ctx: &egui::Context) {
        egui::TopBottomPanel::bottom("native-status").show(ctx, |ui| {
            ui.horizontal(|ui| {
                let page_count = self.page_count;
                let current_page = self.scroll_to_page.unwrap_or(0);
                let mut jump_page = None;
                if ui.small_button("◀").clicked() {
                    jump_page = Some(current_page.saturating_sub(1));
                }
                if ui.small_button("▶").clicked() {
                    jump_page = Some((current_page + 1).min(page_count.saturating_sub(1)));
                }
                let tab = self.active_tab();
                let words = tab.map(|tab| tab.document.word_count()).unwrap_or(0);
                let chars = tab.map(|tab| tab.document.character_count()).unwrap_or(0);
                ui.label(format!("第 {} 页 / 共 {} 页", current_page + 1, page_count));
                ui.separator();
                ui.label(format!("{words} 词 · {chars} 字符"));
                ui.separator();
                if let Some(path) = tab.and_then(|tab| tab.path.as_ref()) {
                    ui.label(RichText::new(path.display().to_string()).small().color(Color32::GRAY));
                } else {
                    ui.label(RichText::new("尚未保存到文件").small().color(Color32::GRAY));
                }
                ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                    ui.label(RichText::new(&self.status).small());
                    ui.label(RichText::new(&self.cloud_status).small().color(Color32::GRAY));
                    if let Some(tab) = self.active_tab() {
                        if let Some(error) = &tab.error {
                            ui.label(RichText::new(error).small().color(Color32::RED));
                        }
                    }
                });
                if let Some(page) = jump_page {
                    self.scroll_to_page = Some(page);
                }
            });
        });
    }

    fn webdav_window(&mut self, ctx: &egui::Context) {
        let mut open = self.webdav_open;
        let mut save = false;
        let mut cancel = false;
        egui::Window::new("WebDAV 设置")
            .open(&mut open)
            .resizable(false)
            .show(ctx, |ui| {
                ui.label("WebDAV 目录 URL");
                ui.add(
                    TextEdit::singleline(&mut self.webdav_url)
                        .desired_width(360.0)
                        .hint_text("https://example.com/dav/qingwen/"),
                );
                ui.label("用户名");
                ui.add(
                    TextEdit::singleline(&mut self.webdav_username)
                        .desired_width(260.0)
                        .hint_text("WebDAV 用户名"),
                );
                ui.label("密码（保存到系统钥匙串）");
                ui.add(
                    TextEdit::singleline(&mut self.webdav_password)
                        .desired_width(260.0)
                        .password(true)
                        .hint_text("留空则保留现有密码"),
                );
                ui.horizontal(|ui| {
                    ui.label("自动上传");
                    let current = self.settings.auto_cloud_seconds;
                    egui::ComboBox::from_id_salt("native-cloud-interval")
                        .selected_text(if current == 0 {
                            "关闭".to_string()
                        } else {
                            format!("{current} 秒")
                        })
                        .show_ui(ui, |ui| {
                            for seconds in [0_u64, 60, 300, 600] {
                                let label = if seconds == 0 {
                                    "关闭".to_string()
                                } else {
                                    format!("{seconds} 秒")
                                };
                                if ui.selectable_label(current == seconds, label).clicked() {
                                    self.settings.auto_cloud_seconds = seconds;
                                    self.save_settings();
                                }
                            }
                        });
                });
                ui.add_space(7.0);
                ui.label(
                    RichText::new("上传/下载文件名使用当前文档标题；与 Tauri 版共用系统钥匙串凭据。")
                        .small()
                        .color(Color32::GRAY),
                );
                ui.horizontal(|ui| {
                    if ui.button("保存").clicked() {
                        save = true;
                    }
                    if ui.button("取消").clicked() {
                        cancel = true;
                    }
                });
            });
        self.webdav_open = open;
        if save {
            self.save_webdav_settings();
        } else if cancel || !open {
            self.webdav_open = false;
        }
    }

    fn page_setup_window(&mut self, ctx: &egui::Context) {
        let mut open = self.page_setup_open;
        egui::Window::new("页面设置")
            .open(&mut open)
            .resizable(false)
            .show(ctx, |ui| {
                let Some(tab) = self.active_tab_mut() else {
                    return;
                };
                let layout = &mut tab.document.layout;
                let mut changed = false;
                ui.label("页边距（cm）");
                egui::Grid::new("native-margins").num_columns(2).show(ui, |ui| {
                    ui.label("上");
                    changed |= ui.add(egui::Slider::new(&mut layout.margins.top, 0.0..=5.0)).changed();
                    ui.end_row();
                    ui.label("下");
                    changed |= ui.add(egui::Slider::new(&mut layout.margins.bottom, 0.0..=5.0)).changed();
                    ui.end_row();
                    ui.label("左");
                    changed |= ui.add(egui::Slider::new(&mut layout.margins.left, 0.0..=5.0)).changed();
                    ui.end_row();
                    ui.label("右");
                    changed |= ui.add(egui::Slider::new(&mut layout.margins.right, 0.0..=5.0)).changed();
                    ui.end_row();
                });
                ui.label("行距");
                changed |= ui.add(egui::Slider::new(&mut layout.line_height, 1.0..=2.5)).changed();
                ui.label("字号");
                changed |= ui.add(egui::Slider::new(&mut layout.font_size, 8.0..=32.0)).changed();
                ui.label("首行缩进（字符）");
                changed |= ui
                    .add(egui::Slider::new(&mut layout.first_line_indent, 0..=4))
                    .changed();
                ui.label("页眉");
                changed |= ui
                    .add(
                        TextEdit::singleline(&mut layout.header_text)
                            .desired_width(360.0)
                            .hint_text("页眉文字"),
                    )
                    .changed();
                ui.label("页脚");
                changed |= ui
                    .add(
                        TextEdit::singleline(&mut layout.footer_text)
                            .desired_width(360.0)
                            .hint_text("页脚文字"),
                    )
                    .changed();
                if changed {
                    tab.document.layout = layout.clone().normalized();
                    tab.dirty = true;
                }
            });
        self.page_setup_open = open;
    }

    fn about_window(&mut self, ctx: &egui::Context) {
        let mut open = self.about_open;
        egui::Window::new("关于轻文 Native")
            .open(&mut open)
            .resizable(false)
            .show(ctx, |ui| {
                ui.heading("轻文 LWD · Native");
                ui.label("纯 Rust + egui，不使用 WebView、HTML、CSS 或 JavaScript。");
                ui.label("文档格式与 Tauri 版兼容：.lwd JSON v1。");
                ui.label("当前原生版为第一阶段：段落、标题、列表、引用、代码块和基础行内格式。");
                ui.label("表格、图片、分页、WebDAV 会继续补齐。");
            });
        self.about_open = open;
    }

    fn close_prompt_window(&mut self, ctx: &egui::Context) {
        if let Some(index) = self.pending_close_tab {
            if index >= self.tabs.len() {
                self.pending_close_tab = None;
                return;
            }
            let title = self.tabs[index].title.clone();
            let mut action = 0_u8;
            egui::Window::new("未保存的文档")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, Vec2::ZERO)
                .show(ctx, |ui| {
                    ui.label(format!("“{title}”有未保存的修改。"));
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        if ui.button("保存并关闭").clicked() {
                            action = 1;
                        }
                        if ui.button("不保存").clicked() {
                            action = 2;
                        }
                        if ui.button("取消").clicked() {
                            action = 3;
                        }
                    });
                });
            match action {
                1 => {
                    self.active = index;
                    if self.save_dialog(false) {
                        self.pending_close_tab = None;
                        self.close_tab(index);
                    }
                }
                2 => {
                    self.pending_close_tab = None;
                    self.close_tab(index);
                }
                3 => self.pending_close_tab = None,
                _ => {}
            }
        }

        if self.pending_exit {
            let mut action = 0_u8;
            egui::Window::new("退出轻文")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, Vec2::ZERO)
                .show(ctx, |ui| {
                    ui.label(format!(
                        "有 {} 个文档尚未保存。",
                        self.tabs.iter().filter(|tab| tab.dirty).count()
                    ));
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        if ui.button("保存全部并退出").clicked() {
                            action = 1;
                        }
                        if ui.button("直接退出").clicked() {
                            action = 2;
                        }
                        if ui.button("取消").clicked() {
                            action = 3;
                        }
                    });
                });
            match action {
                1 => {
                    if self.save_all_dirty() {
                        self.pending_exit = false;
                        self.allow_exit = true;
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                }
                2 => {
                    self.pending_exit = false;
                    self.allow_exit = true;
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
                3 => self.pending_exit = false,
                _ => {}
            }
        }
    }

    fn handle_shortcuts(&mut self, ctx: &egui::Context) {
        let (
            save,
            save_as,
            open,
            new,
            close,
            find,
        ) = ctx.input(|input| {
            (
                input.modifiers.command && !input.modifiers.shift && input.key_pressed(egui::Key::S),
                input.modifiers.command && input.modifiers.shift && input.key_pressed(egui::Key::S),
                input.modifiers.command && input.key_pressed(egui::Key::O),
                input.modifiers.command && input.key_pressed(egui::Key::N),
                input.modifiers.command && input.key_pressed(egui::Key::W),
                input.modifiers.command && input.key_pressed(egui::Key::F),
            )
        });
        if save_as {
            self.save_dialog(true);
        } else if save {
            self.save_dialog(false);
        }
        if open {
            self.open_dialog();
        }
        if new {
            self.new_tab();
        }
        if close {
            self.close_current_tab();
        }
        if find {
            self.find_open = true;
            self.refresh_find_matches();
        }
    }
}

impl eframe::App for NativeApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if !self.allow_exit
            && self.has_dirty_tabs()
            && ctx.input(|input| input.viewport().close_requested())
        {
            self.pending_exit = true;
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        }
        self.apply_pending_format();
        self.handle_shortcuts(ctx);
        self.poll_open_requests(ctx);
        self.poll_cloud();
        self.autosave();
        self.cloud_tick();

        egui::TopBottomPanel::top("native-top").show(ctx, |ui| {
            self.ribbon(ui);
        });
        if self.sidebar_visible {
            self.side_panel(ctx);
        }
        self.status_bar(ctx);
        self.central_page(ctx);
        self.page_setup_window(ctx);
        self.webdav_window(ctx);
        self.about_window(ctx);
        self.close_prompt_window(ctx);

        if self.settings.autosave_seconds > 0 || self.cloud_inflight || self.settings.auto_cloud_seconds > 0 {
            ctx.request_repaint_after(Duration::from_secs(1));
        }
    }
}

fn install_chinese_fonts(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();
    let candidates = [
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\msyh.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    ];
    for path in candidates {
        if let Ok(data) = fs::read(path) {
            fonts
                .font_data
                .insert("cjk".to_owned(), FontData::from_owned(data).into());
            if let Some(family) = fonts.families.get_mut(&FontFamily::Proportional) {
                family.insert(0, "cjk".to_owned());
            }
            if let Some(family) = fonts.families.get_mut(&FontFamily::Monospace) {
                family.push("cjk".to_owned());
            }
            break;
        }
    }
    ctx.set_fonts(fonts);
}

fn configure_style(ctx: &egui::Context) {
    let mut style = (*ctx.style()).clone();
    style.text_styles.insert(
        TextStyle::Body,
        egui::FontId::new(14.0, FontFamily::Proportional),
    );
    style.text_styles.insert(
        TextStyle::Button,
        egui::FontId::new(13.0, FontFamily::Proportional),
    );
    style.spacing.item_spacing = Vec2::new(8.0, 6.0);
    style.visuals = egui::Visuals::light();
    style.visuals.panel_fill = Color32::from_rgb(246, 248, 252);
    style.visuals.window_fill = Color32::from_rgb(252, 253, 255);
    style.visuals.selection.bg_fill = Color32::from_rgb(196, 218, 252);
    style.visuals.hyperlink_color = Color32::from_rgb(47, 111, 235);
    ctx.set_style(style);
}

fn open_queue_dir() -> PathBuf {
    std::env::temp_dir().join("qingwen-native-open")
}

fn queue_open_requests(paths: &[String]) -> Result<(), String> {
    let directory = open_queue_dir();
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建单实例队列：{error}"))?;
    let stamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
    if paths.is_empty() {
        let file = directory.join(format!("{stamp}-{}-focus", std::process::id()));
        fs::write(file, "").map_err(|error| format!("无法发送聚焦请求：{error}"))?;
    } else {
        for (index, path) in paths.iter().enumerate() {
            let file = directory.join(format!(
                "{stamp}-{}-{index}.request",
                std::process::id()
            ));
            fs::write(file, path).map_err(|error| format!("无法发送打开请求：{error}"))?;
        }
    }
    Ok(())
}

#[derive(Default)]
struct BlockRenderResult {
    changed: bool,
    focus: Option<u64>,
    selection: Option<(u64, usize, usize)>,
    insert_after: Option<u64>,
    delete_block: Option<u64>,
    scroll_rect: Option<egui::Rect>,
}

fn estimate_block_height(
    block: &Block,
    layout: &PageLayout,
    content_width: f32,
    textures: &HashMap<u64, TextureHandle>,
) -> f32 {
    let font_size = match block.kind {
        BlockKind::Heading(level) => layout.font_size + (5.0 - level as f32).max(1.0) * 3.0,
        _ => layout.font_size,
    };
    let line_height = font_size * 1.45 * layout.line_height.max(1.0) * 0.72;
    let char_width = (font_size * 0.95).max(1.0);
    let line_chars = (content_width / char_width).max(8.0);
    let mut lines = 0.0_f32;
    for line in block.text.split('\n') {
        lines += (line.chars().count() as f32 / line_chars).ceil().max(1.0);
    }
    let mut height = lines * line_height + 30.0;
    match block.kind {
        BlockKind::Table => {
            let rows = block.table.as_ref().map(|table| table.rows.len()).unwrap_or(1);
            height = rows as f32 * 31.0 + 32.0;
        }
        BlockKind::Image => {
            if let Some(texture) = textures.get(&block.id) {
                let natural = texture.size_vec2();
                height = (content_width * natural.y / natural.x.max(1.0)).min(520.0) + 30.0;
            }
        }
        BlockKind::Raw(_) => height = 26.0,
        _ => {}
    }
    (height + 6.0).max(36.0)
}

fn render_one_block(
    ui: &mut Ui,
    block: &mut Block,
    index: usize,
    content_width: f32,
    layout: &PageLayout,
    find_ranges: &[(u64, usize, usize, bool)],
    textures: &HashMap<u64, TextureHandle>,
    scroll_pending: bool,
    find_active_block: Option<u64>,
) -> BlockRenderResult {
    let mut result = BlockRenderResult::default();

    let old_text = block.text.clone();
    let block_id = block.id;
    let kind = block.kind.clone();
    let font_size = if let BlockKind::Heading(level) = kind {
        layout.font_size + (5.0 - level as f32).max(1.0) * 3.0
    } else {
        layout.font_size
    };
    let is_code = matches!(kind, BlockKind::Code);
    let marks = block.marks.clone();
    let editable = kind.is_editable();
    let block_find: Vec<(usize, usize, bool)> = find_ranges
        .iter()
        .filter(|(id, _, _, _)| *id == block_id)
        .map(|(_, start, end, active)| (*start, *end, *active))
        .collect();

    ui.horizontal(|ui| {
        match kind {
            BlockKind::Bullet => {
                ui.label("•");
            }
            BlockKind::Ordered => {
                ui.label(format!("{}.", index + 1));
            }
            BlockKind::Quote => {
                ui.label(RichText::new("▍").color(Color32::from_rgb(90, 140, 220)));
            }
            _ => {}
        }
        ui.allocate_ui_with_layout(
            egui::vec2(content_width, 0.0),
            egui::Layout::top_down(egui::Align::LEFT),
            |ui| {
            ui.set_width(content_width);
            ui.set_max_width(content_width);
            if editable {
                let mut layouter = |ui: &Ui, text: &str, _wrap_width: f32| {
                    let mut job = LayoutJob::default();
                    job.wrap.max_width = (content_width - 36.0).max(120.0);
                    let mut boundaries = vec![0, text.len()];
                    for range in &marks {
                        if range.start < range.end && range.end <= text.len() {
                            boundaries.push(range.start);
                            boundaries.push(range.end);
                        }
                    }
                    for (start, end, _) in &block_find {
                        if *start < *end && *end <= text.len() {
                            boundaries.push(*start);
                            boundaries.push(*end);
                        }
                    }
                    boundaries.sort_unstable();
                    boundaries.dedup();
                    for window in boundaries.windows(2) {
                        let start = window[0];
                        let end = window[1];
                        if start >= end {
                            continue;
                        }
                        let segment_marks = marks_at(&marks, start, end);
                        let find_hit = block_find
                            .iter()
                            .find(|(find_start, find_end, _)| *find_start <= start && *find_end >= end);
                        let color = if segment_marks.code {
                            Color32::from_rgb(170, 60, 40)
                        } else {
                            Color32::from_rgb(32, 38, 48)
                        };
                        let mut format = egui::TextFormat {
                            font_id: if is_code {
                                FontId::monospace(font_size)
                            } else {
                                FontId::proportional(font_size)
                            },
                            color,
                            background: if let Some((_, _, active_match)) = find_hit {
                                if *active_match {
                                    Color32::from_rgb(255, 196, 120)
                                } else {
                                    Color32::from_rgb(255, 243, 170)
                                }
                            } else if segment_marks.highlight {
                                Color32::from_rgb(255, 240, 150)
                            } else {
                                Color32::TRANSPARENT
                            },
                            underline: if segment_marks.underline {
                                Stroke::new(1.0_f32, color)
                            } else {
                                Stroke::NONE
                            },
                            strikethrough: if segment_marks.strike {
                                Stroke::new(1.0_f32, color)
                            } else {
                                Stroke::NONE
                            },
                            ..Default::default()
                        };
                        format.italics = segment_marks.italic;
                        job.append(&text[start..end], 0.0, format);
                    }
                    if job.sections.is_empty() {
                        job.append("", 0.0, egui::TextFormat::default());
                    }
                    ui.fonts(|fonts| fonts.layout_job(job))
                };
                let empty_block = block.text.is_empty();
                let output = TextEdit::multiline(&mut block.text)
                    .id(egui::Id::new(("native-block", block_id)))
                    .font(FontId::proportional(font_size))
                    .desired_width((content_width - 36.0).max(120.0))
                    .frame(false)
                    .hint_text(if empty_block { "开始写作…" } else { "" })
                    .layouter(&mut layouter)
                    .show(ui);
                if output.response.changed() {
                    adjust_marks_after_edit(block, &old_text);
                    result.changed = true;
                }
                if scroll_pending && find_active_block == Some(block_id) {
                    result.scroll_rect = Some(output.response.rect);
                }
                if output.response.has_focus() {
                    result.focus = Some(block_id);
                    if let Some(range) = output.cursor_range {
                        let a = byte_index(&block.text, range.primary.ccursor.index);
                        let b = byte_index(&block.text, range.secondary.ccursor.index);
                        result.selection = Some((block_id, a.min(b), a.max(b)));
                    }
                }
            } else if matches!(kind, BlockKind::Table) {
                if let Some(table) = block.table.as_mut() {
                    if render_editable_table(ui, block_id, table, content_width) {
                        result.changed = true;
                    }
                }
            } else if matches!(kind, BlockKind::PageBreak) {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new("┄┄┄  分页符  ┄┄┄")
                            .small()
                            .color(Color32::from_rgb(120, 132, 150)),
                    );
                });
            } else if matches!(kind, BlockKind::Raw("horizontalRule")) {
                ui.separator();
            } else if matches!(kind, BlockKind::Image) {
                if let Some(texture) = textures.get(&block_id) {
                    let natural = texture.size_vec2();
                    let scale = (content_width / natural.x.max(1.0)).min(1.0);
                    ui.add(
                        egui::Image::new((texture.id(), natural * scale))
                            .maintain_aspect_ratio(true),
                    );
                } else {
                    ui.label(
                        RichText::new("[图片无法解码；保存时仍会保留原始数据]")
                            .italics()
                            .color(Color32::GRAY),
                    );
                }
            } else {
                ui.label(
                    RichText::new(format!(
                        "[{} 内容由 Tauri 版创建，原生版暂只读；保存时会原样保留]",
                        kind.label()
                    ))
                    .italics()
                    .color(Color32::GRAY),
                );
            }
            ui.horizontal(|ui| {
                if ui.small_button("＋ 段落").on_hover_text("在下方插入段落").clicked() {
                    result.insert_after = Some(block_id);
                }
                if ui.small_button("删除").on_hover_text("删除这个段落").clicked() {
                    result.delete_block = Some(block_id);
                }
            });
        });
    });
    result
}

fn ribbon_group(ui: &mut Ui, label: &str, add: impl FnOnce(&mut Ui)) {
    ui.vertical(|ui| {
        ui.horizontal(|ui| add(ui));
        ui.label(RichText::new(label).small().color(Color32::GRAY));
    });
    ui.separator();
}

fn draw_vertical_ruler(ui: &mut Ui, page_height: f32, top: f32, bottom: f32, scale: f32) {
    let origin = ui.min_rect().left_top();
    let rect = egui::Rect::from_min_size(
        egui::pos2(origin.x + 5.0, origin.y),
        egui::vec2(16.0, page_height),
    );
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, Color32::from_rgb(246, 248, 252));
    painter.rect_stroke(
        rect,
        2.0,
        Stroke::new(1.0_f32, Color32::from_rgb(220, 227, 238)),
        egui::StrokeKind::Inside,
    );
    let content_top = rect.top() + top;
    let content_bottom = (rect.bottom() - bottom).max(content_top);
    painter.rect_filled(
        egui::Rect::from_min_max(
            egui::pos2(rect.left(), rect.top()),
            egui::pos2(rect.right(), content_top),
        ),
        0.0,
        Color32::from_rgb(232, 237, 247),
    );
    painter.rect_filled(
        egui::Rect::from_min_max(
            egui::pos2(rect.left(), content_bottom),
            egui::pos2(rect.right(), rect.bottom()),
        ),
        0.0,
        Color32::from_rgb(232, 237, 247),
    );
    let mut cm = 0;
    let mut y = content_top;
    while y <= content_bottom && cm <= 30 {
        let major = cm % 5 == 0;
        painter.line_segment(
            [
                egui::pos2(rect.right() - if major { 9.0 } else { 5.0 }, y),
                egui::pos2(rect.right(), y),
            ],
            Stroke::new(1.0_f32, Color32::from_rgb(145, 158, 178)),
        );
        if major {
            painter.text(
                egui::pos2(rect.left() + 1.0, y + 1.0),
                egui::Align2::LEFT_TOP,
                cm.to_string(),
                FontId::proportional(8.0),
                Color32::from_rgb(120, 132, 150),
            );
        }
        cm += 1;
        y += scale;
    }
}

fn draw_ruler(ui: &mut Ui, page_width: f32, left: f32, right: f32, scale: f32) {
    let (rect, _) = ui.allocate_exact_size(egui::vec2(page_width, 18.0), egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 3.0, Color32::from_rgb(246, 248, 252));
    painter.rect_stroke(
        rect,
        3.0,
        Stroke::new(1.0_f32, Color32::from_rgb(218, 226, 240)),
        egui::StrokeKind::Inside,
    );
    painter.rect_filled(
        egui::Rect::from_min_max(
            egui::pos2(rect.left(), rect.top()),
            egui::pos2(rect.left() + left, rect.bottom()),
        ),
        0.0,
        Color32::from_rgb(232, 237, 247),
    );
    painter.rect_filled(
        egui::Rect::from_min_max(
            egui::pos2(rect.right() - right, rect.top()),
            egui::pos2(rect.right(), rect.bottom()),
        ),
        0.0,
        Color32::from_rgb(232, 237, 247),
    );
    for cm in 0..=21 {
        let x = rect.left() + cm as f32 * scale;
        let major = cm % 5 == 0;
        painter.line_segment(
            [
                egui::pos2(x, rect.bottom() - if major { 9.0 } else { 5.0 }),
                egui::pos2(x, rect.bottom()),
            ],
            Stroke::new(1.0_f32, Color32::from_rgb(145, 158, 178)),
        );
        if major {
            painter.text(
                egui::pos2(x + 2.0, rect.top() + 1.0),
                egui::Align2::LEFT_TOP,
                cm.to_string(),
                FontId::proportional(9.0),
                Color32::from_rgb(120, 132, 150),
            );
        }
    }
}

fn sanitize_stem(value: &str) -> String {
    let value = value.trim().trim_end_matches(".lwd");
    let mut result = String::new();
    for character in value.chars().take(80) {
        if character.is_control() || r#"<>:"/\|?*"#.contains(character) {
            result.push(' ');
        } else {
            result.push(character);
        }
    }
    let result = result.split_whitespace().collect::<Vec<_>>().join(" ");
    let result = result.trim_matches(['.', ' ']).to_string();
    if result.is_empty() {
        "未命名文档".to_string()
    } else {
        result
    }
}

fn unique_document_path(dir: &Path, title: &str) -> PathBuf {
    let stem = sanitize_stem(title);
    for index in 1..10_000u32 {
        let name = if index == 1 {
            format!("{stem}.lwd")
        } else {
            format!("{stem} {index}.lwd")
        };
        let path = dir.join(name);
        if !path.exists() {
            return path;
        }
    }
    dir.join(format!("{stem}-{}.lwd", chrono::Utc::now().timestamp()))
}

fn render_editable_table(ui: &mut Ui, block_id: u64, table: &mut TableData, content_width: f32) -> bool {
    if table.rows.is_empty() {
        table.rows.push(vec![TableCell::default(); 3]);
    }
    let mut changed = false;
    let cols = table.rows.iter().map(Vec::len).max().unwrap_or(1).max(1);
    let cell_width = (content_width / cols as f32).max(90.0);
    ui.label(
        RichText::new("表格（单元格可直接编辑；当前保留纯文本）")
            .small()
            .color(Color32::GRAY),
    );
    egui::Frame::NONE
        .stroke(Stroke::new(1.0_f32, Color32::from_rgb(205, 215, 230)))
        .inner_margin(egui::Margin::same(4))
        .show(ui, |ui| {
            ui.set_max_width(content_width);
            egui::Grid::new(format!("native-table-edit-{block_id}"))
                .striped(true)
                .min_col_width(cell_width)
                .show(ui, |ui| {
                    for (row_index, row) in table.rows.iter_mut().enumerate() {
                        if row.is_empty() {
                            row.push(TableCell::default());
                        }
                        for cell in row {
                            let edit = egui::TextEdit::singleline(&mut cell.text)
                                .desired_width((cell_width - 10.0).max(60.0))
                                .hint_text(if row_index == 0 && table.header {
                                    "表头"
                                } else {
                                    ""
                                });
                            changed |= ui.add(edit).changed();
                        }
                        ui.end_row();
                    }
                });
        });
    ui.horizontal(|ui| {
        if ui.small_button("＋行").clicked() {
            let count = table.rows.iter().map(Vec::len).max().unwrap_or(1).max(1);
            table.rows.push(vec![TableCell::default(); count]);
            changed = true;
        }
        if ui.small_button("＋列").clicked() {
            for row in &mut table.rows {
                row.push(TableCell::default());
            }
            changed = true;
        }
        if ui.small_button("－行").clicked() {
            if table.rows.len() > 1 {
                table.rows.pop();
                changed = true;
            }
        }
        if ui.small_button("－列").clicked() {
            if table.rows.iter().all(|row| row.len() > 1) {
                for row in &mut table.rows {
                    row.pop();
                }
                changed = true;
            }
        }
        let mut header = table.header;
        if ui.checkbox(&mut header, "首行表头").changed() {
            table.header = header;
            changed = true;
        }
    });
    changed
}

fn table_rows(block: &Block) -> Vec<Vec<String>> {
    let Some(rows) = block
        .raw
        .as_ref()
        .and_then(|raw| raw.get("content"))
        .and_then(|value| value.as_array())
    else {
        return Vec::new();
    };
    rows.iter()
        .map(|row| {
            row.get("content")
                .and_then(|value| value.as_array())
                .map(|cells| cells.iter().map(plain_cell_text).collect())
                .unwrap_or_default()
        })
        .collect()
}

fn plain_cell_text(cell: &serde_json::Value) -> String {
    fn collect(node: &serde_json::Value, out: &mut String) {
        match node.get("type").and_then(|value| value.as_str()).unwrap_or_default() {
            "text" => {
                if let Some(text) = node.get("text").and_then(|value| value.as_str()) {
                    out.push_str(text);
                }
            }
            "hardBreak" => out.push('\n'),
            _ => {
                if let Some(children) = node.get("content").and_then(|value| value.as_array()) {
                    for child in children {
                        collect(child, out);
                    }
                    if matches!(
                        node.get("type").and_then(|value| value.as_str()),
                        Some("paragraph" | "heading")
                    ) && !out.ends_with('\n')
                    {
                        out.push('\n');
                    }
                }
            }
        }
    }
    let mut out = String::new();
    collect(cell, &mut out);
    out.trim_end().to_string()
}

fn render_table(ui: &mut Ui, block: &Block, content_width: f32) {
    let rows = table_rows(block);
    if rows.is_empty() {
        ui.label(RichText::new("[空表格]").italics().color(Color32::GRAY));
        return;
    }
    ui.label(
        RichText::new("表格（原生版当前为只读；保存时保留原始结构）")
            .small()
            .color(Color32::GRAY),
    );
    egui::Frame::NONE
        .stroke(Stroke::new(1.0_f32, Color32::from_rgb(205, 215, 230)))
        .inner_margin(egui::Margin::same(1))
        .show(ui, |ui| {
            ui.set_max_width(content_width);
            egui::Grid::new(format!("native-table-{}", block.id))
                .striped(true)
                .min_col_width((content_width / rows.iter().map(Vec::len).max().unwrap_or(1) as f32).max(80.0))
                .show(ui, |ui| {
                    for row in &rows {
                        for cell in row {
                            ui.label(if cell.is_empty() { " " } else { cell.as_str() });
                        }
                        ui.end_row();
                    }
                });
        });
}

fn load_data_url_texture(
    ctx: &egui::Context,
    id: u64,
    src: &str,
) -> Option<TextureHandle> {
    let (_, data) = src.split_once(";base64,")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .ok()?;
    let decoded = image::load_from_memory(&bytes).ok()?.to_rgba8();
    let (width, height) = decoded.dimensions();
    if width == 0 || height == 0 || width > 12_000 || height > 12_000 {
        return None;
    }
    let color = egui::ColorImage::from_rgba_unmultiplied(
        [width as usize, height as usize],
        decoded.as_raw(),
    );
    Some(ctx.load_texture(
        format!("native-image-{id}"),
        color,
        egui::TextureOptions::LINEAR,
    ))
}

fn marks_at(marks: &[crate::model::MarkRange], start: usize, end: usize) -> Marks {
    let mut result = Marks::default();
    for range in marks {
        if range.start <= start && range.end >= end {
            result.bold |= range.marks.bold;
            result.italic |= range.marks.italic;
            result.underline |= range.marks.underline;
            result.strike |= range.marks.strike;
            result.code |= range.marks.code;
            result.highlight |= range.marks.highlight;
        }
    }
    result
}
