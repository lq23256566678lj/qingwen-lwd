use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Marks {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strike: bool,
    pub code: bool,
    pub highlight: bool,
}

impl Marks {
    pub fn is_empty(self) -> bool {
        self == Self::default()
    }

    fn names(self) -> Vec<&'static str> {
        let mut names = Vec::new();
        if self.bold {
            names.push("bold");
        }
        if self.italic {
            names.push("italic");
        }
        if self.underline {
            names.push("underline");
        }
        if self.strike {
            names.push("strike");
        }
        if self.code {
            names.push("code");
        }
        if self.highlight {
            names.push("highlight");
        }
        names
    }

    fn from_mark(value: &Value) -> Option<Self> {
        let mut marks = Self::default();
        match value.get("type")?.as_str()? {
            "bold" => marks.bold = true,
            "italic" => marks.italic = true,
            "underline" => marks.underline = true,
            "strike" => marks.strike = true,
            "code" => marks.code = true,
            "highlight" => marks.highlight = true,
            _ => return None,
        }
        Some(marks)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MarkRange {
    pub start: usize,
    pub end: usize,
    pub marks: Marks,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BlockKind {
    Paragraph,
    Heading(u8),
    Bullet,
    Ordered,
    Quote,
    Code,
    Image,
    Table,
    PageBreak,
    Raw(&'static str),
}

impl BlockKind {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Paragraph => "正文",
            Self::Heading(1) => "标题 1",
            Self::Heading(2) => "标题 2",
            Self::Heading(3) => "标题 3",
            Self::Heading(_) => "标题",
            Self::Bullet => "项目符号",
            Self::Ordered => "编号列表",
            Self::Quote => "引用",
            Self::Code => "代码块",
            Self::Image => "图片",
            Self::Table => "表格",
            Self::PageBreak => "分页符",
            Self::Raw("horizontalRule") => "分隔线",
            Self::Raw(_) => "未支持内容",
        }
    }

    pub fn is_editable(&self) -> bool {
        !matches!(self, Self::Raw(_) | Self::Image | Self::Table | Self::PageBreak)
    }
}

#[derive(Clone, Debug, Default)]
pub struct TableCell {
    pub text: String,
}

#[derive(Clone, Debug, Default)]
pub struct TableData {
    pub header: bool,
    pub rows: Vec<Vec<TableCell>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum TextAlign {
    #[default]
    Left,
    Center,
    Right,
}

impl TextAlign {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Center => "center",
            Self::Right => "right",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "center" => Self::Center,
            "right" => Self::Right,
            _ => Self::Left,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Block {
    pub id: u64,
    pub kind: BlockKind,
    pub text: String,
    pub marks: Vec<MarkRange>,
    pub raw: Option<Value>,
    pub table: Option<TableData>,
    pub align: TextAlign,
    pub continuation: bool,
    pub chunked: bool,
}

impl Block {
    pub fn new(id: u64, kind: BlockKind, text: String) -> Self {
        Self {
            id,
            kind,
            text,
            marks: Vec::new(),
            raw: None,
            table: None,
            align: TextAlign::Left,
            continuation: false,
            chunked: false,
        }
    }

    pub fn plain_marks(&mut self) {
        self.marks.clear();
    }

    pub fn display_text(&self) -> String {
        if self.kind.is_editable() {
            self.text.clone()
        } else {
            format!("[{}]", self.kind.label())
        }
    }
}

#[derive(Clone, Debug)]
pub struct Document {
    pub blocks: Vec<Block>,
    pub layout: PageLayout,
}

impl Document {
    pub fn blank(layout: PageLayout) -> Self {
        Self {
            blocks: Vec::new(),
            layout,
        }
    }

    pub fn word_count(&self) -> usize {
        self.blocks
            .iter()
            .filter(|block| block.kind.is_editable())
            .flat_map(|block| block.text.split_whitespace())
            .count()
    }

    pub fn character_count(&self) -> usize {
        self.blocks
            .iter()
            .filter(|block| block.kind.is_editable())
            .map(|block| block.text.chars().count())
            .sum()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Margins {
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub left: f32,
}

impl Default for Margins {
    fn default() -> Self {
        Self {
            top: 2.5,
            right: 2.5,
            bottom: 2.5,
            left: 2.5,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct PageLayout {
    #[serde(rename = "lineHeight")]
    pub line_height: f32,
    pub margins: Margins,
    #[serde(rename = "firstLineIndent")]
    pub first_line_indent: u32,
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    #[serde(default)]
    pub header_text: String,
    #[serde(default)]
    pub footer_text: String,
    #[serde(default)]
    pub different_first_page: bool,
    #[serde(default)]
    pub page_border: bool,
    #[serde(default)]
    pub watermark: String,
}

impl Default for PageLayout {
    fn default() -> Self {
        Self {
            line_height: 1.85,
            margins: Margins::default(),
            first_line_indent: 0,
            font_family: String::new(),
            font_size: 16.0,
            header_text: String::new(),
            footer_text: String::new(),
            different_first_page: false,
            page_border: false,
            watermark: String::new(),
        }
    }
}

impl PageLayout {
    pub fn normalized(mut self) -> Self {
        self.line_height = self.line_height.clamp(1.0, 2.5);
        self.font_size = self.font_size.clamp(8.0, 96.0);
        self.first_line_indent = self.first_line_indent.min(4);
        for value in [
            &mut self.margins.top,
            &mut self.margins.right,
            &mut self.margins.bottom,
            &mut self.margins.left,
        ] {
            *value = value.clamp(0.0, 5.0);
        }
        self
    }
}

pub fn byte_index(text: &str, char_index: usize) -> usize {
    text.char_indices()
        .nth(char_index)
        .map(|(index, _)| index)
        .unwrap_or(text.len())
}

pub fn parse_document(value: &Value) -> Document {
    let layout = value
        .get("meta")
        .and_then(|meta| meta.get("layout"))
        .and_then(|layout| serde_json::from_value::<PageLayout>(layout.clone()).ok())
        .unwrap_or_default()
        .normalized();
    let mut blocks = Vec::new();
    if let Some(content) = value
        .get("document")
        .and_then(|document| document.get("content"))
        .and_then(Value::as_array)
    {
        for node in content {
            parse_block(node, None, &mut blocks);
        }
    }
    if blocks.is_empty() {
        blocks.push(Block::new(0, BlockKind::Paragraph, String::new()));
    }
    assign_ids(&mut blocks);
    Document { blocks, layout }
}

fn assign_ids(blocks: &mut [Block]) {
    for (index, block) in blocks.iter_mut().enumerate() {
        block.id = index as u64 + 1;
    }
}

fn parse_block(node: &Value, forced: Option<BlockKind>, out: &mut Vec<Block>) {
    let node_type = node.get("type").and_then(Value::as_str).unwrap_or_default();
    let align = node
        .get("attrs")
        .and_then(|attrs| attrs.get("textAlign"))
        .and_then(Value::as_str)
        .map(TextAlign::from_str)
        .unwrap_or_default();
    match node_type {
        "paragraph" | "heading" => {
            let (text, marks) = collect_inline(node);
            let kind = forced.unwrap_or_else(|| {
                if node_type == "heading" {
                    BlockKind::Heading(
                        node.get("attrs")
                            .and_then(|attrs| attrs.get("level"))
                            .and_then(Value::as_u64)
                            .unwrap_or(1) as u8,
                    )
                } else {
                    BlockKind::Paragraph
                }
            });
            out.push(Block {
                id: 0,
                kind,
                text,
                marks,
                raw: None,
                table: None,
                align,
                continuation: false,
                chunked: false,
            });
        }
        "bulletList" | "orderedList" => {
            let kind = if node_type == "bulletList" {
                BlockKind::Bullet
            } else {
                BlockKind::Ordered
            };
            if let Some(items) = node.get("content").and_then(Value::as_array) {
                for item in items {
                    if let Some(children) = item.get("content").and_then(Value::as_array) {
                        for child in children {
                            parse_block(child, Some(kind.clone()), out);
                        }
                    }
                }
            }
        }
        "blockquote" => {
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    parse_block(child, Some(BlockKind::Quote), out);
                }
            }
        }
        "codeBlock" => {
            let (text, _) = collect_inline(node);
            out.push(Block {
                id: 0,
                kind: BlockKind::Code,
                text,
                marks: Vec::new(),
                raw: None,
                table: None,
                align,
                continuation: false,
                chunked: false,
            });
        }
        "pageBreak" => {
            out.push(Block {
                id: 0,
                kind: BlockKind::PageBreak,
                text: String::new(),
                marks: Vec::new(),
                raw: Some(node.clone()),
                table: None,
                align,
                continuation: false,
                chunked: false,
            });
        }
        "image" => {
            out.push(Block {
                id: 0,
                kind: BlockKind::Image,
                text: String::new(),
                marks: Vec::new(),
                raw: Some(node.clone()),
                table: None,
                align,
                continuation: false,
                chunked: false,
            });
        }
        "table" => {
            out.push(Block {
                id: 0,
                kind: BlockKind::Table,
                text: String::new(),
                marks: Vec::new(),
                raw: Some(node.clone()),
                table: Some(parse_table(node)),
                align,
                continuation: false,
                chunked: false,
            });
        }
        "horizontalRule" => {
            out.push(Block {
                id: 0,
                kind: BlockKind::Raw("horizontalRule"),
                text: String::new(),
                marks: Vec::new(),
                raw: Some(node.clone()),
                table: None,
                align,
                continuation: false,
                chunked: false,
            });
        }
        _ => {
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    parse_block(child, forced.clone(), out);
                }
            }
        }
    }
}

fn parse_table(node: &Value) -> TableData {
    let mut rows = Vec::new();
    let mut header = false;
    if let Some(row_nodes) = node.get("content").and_then(Value::as_array) {
        for (row_index, row_node) in row_nodes.iter().enumerate() {
            let mut cells = Vec::new();
            if let Some(cell_nodes) = row_node.get("content").and_then(Value::as_array) {
                for cell_node in cell_nodes {
                    let is_header = cell_node
                        .get("type")
                        .and_then(Value::as_str)
                        .is_some_and(|kind| kind == "tableHeader");
                    if row_index == 0 && is_header {
                        header = true;
                    }
                    let mut text = String::new();
                    collect_cell_text(cell_node, &mut text);
                    cells.push(TableCell {
                        text: text.trim_end().to_string(),
                    });
                }
            }
            rows.push(cells);
        }
    }
    TableData { header, rows }
}

fn collect_cell_text(node: &Value, out: &mut String) {
    match node.get("type").and_then(Value::as_str).unwrap_or_default() {
        "text" => {
            if let Some(text) = node.get("text").and_then(Value::as_str) {
                out.push_str(text);
            }
        }
        "hardBreak" => out.push('\n'),
        _ => {
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    collect_cell_text(child, out);
                }
                if matches!(
                    node.get("type").and_then(Value::as_str),
                    Some("paragraph" | "heading")
                ) && !out.ends_with('\n')
                {
                    out.push('\n');
                }
            }
        }
    }
}

fn table_to_json(table: &TableData) -> Value {
    let rows: Vec<Value> = table
        .rows
        .iter()
        .enumerate()
        .map(|(row_index, row)| {
            let cells: Vec<Value> = row
                .iter()
                .map(|cell| {
                    let kind = if table.header && row_index == 0 {
                        "tableHeader"
                    } else {
                        "tableCell"
                    };
                    let content = if cell.text.is_empty() {
                        json!({ "type": "paragraph" })
                    } else {
                        json!({
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": cell.text }],
                        })
                    };
                    json!({
                        "type": kind,
                        "content": [content],
                    })
                })
                .collect();
            json!({
                "type": "tableRow",
                "content": cells,
            })
        })
        .collect();
    json!({
        "type": "table",
        "content": rows,
    })
}

fn collect_inline(node: &Value) -> (String, Vec<MarkRange>) {
    let mut text = String::new();
    let mut ranges = Vec::new();
    collect_inline_into(node, &mut text, &mut ranges);
    (text, ranges)
}

fn collect_inline_into(node: &Value, text: &mut String, ranges: &mut Vec<MarkRange>) {
    match node.get("type").and_then(Value::as_str).unwrap_or_default() {
        "text" => {
            let value = node.get("text").and_then(Value::as_str).unwrap_or_default();
            let start = text.len();
            text.push_str(value);
            let end = text.len();
            let mut marks = Marks::default();
            if let Some(items) = node.get("marks").and_then(Value::as_array) {
                for item in items {
                    if let Some(mark) = Marks::from_mark(item) {
                        marks.bold |= mark.bold;
                        marks.italic |= mark.italic;
                        marks.underline |= mark.underline;
                        marks.strike |= mark.strike;
                        marks.code |= mark.code;
                        marks.highlight |= mark.highlight;
                    }
                }
            }
            if !marks.is_empty() && start < end {
                ranges.push(MarkRange {
                    start,
                    end,
                    marks,
                });
            }
        }
        "hardBreak" => text.push('\n'),
        _ => {
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    collect_inline_into(child, text, ranges);
                }
            }
        }
    }
}

pub fn document_to_json(document: &Document) -> Value {
    let mut content = Vec::new();
    let mut index = 0;
    while index < document.blocks.len() {
        let block = &document.blocks[index];
        match block.kind {
            BlockKind::Bullet | BlockKind::Ordered => {
                let kind = if block.kind == BlockKind::Bullet {
                    "bulletList"
                } else {
                    "orderedList"
                };
                let mut items = Vec::new();
                while index < document.blocks.len()
                    && document.blocks[index].kind == block.kind
                {
                    let item = &document.blocks[index];
                    if let Some(node) = paragraph_node(item, Some(item.kind.label())) {
                        items.push(json!({
                            "type": "listItem",
                            "content": [node],
                        }));
                    }
                    index += 1;
                }
                content.push(json!({ "type": kind, "content": items }));
                continue;
            }
            _ => {
                if let Some(node) = block_to_json(block) {
                    content.push(node);
                }
            }
        }
        index += 1;
    }
    if content.is_empty() {
        content.push(json!({ "type": "paragraph" }));
    }
    json!({ "type": "doc", "content": content })
}

pub fn merged_for_save(document: &Document) -> Document {
    let mut merged = document.clone();
    let mut blocks: Vec<Block> = Vec::new();
    for block in merged.blocks.drain(..) {
        if block.continuation {
            if let Some(previous) = blocks.last_mut() {
                if matches!(block.kind, BlockKind::Table) {
                    if let (Some(previous_table), Some(block_table)) =
                        (previous.table.as_mut(), block.table.as_ref())
                    {
                        let skip = if block_table.header { 1 } else { 0 };
                        previous_table
                            .rows
                            .extend(block_table.rows.iter().skip(skip).cloned());
                        continue;
                    }
                }
                let offset = previous.text.len();
                previous.text.push_str(&block.text);
                for mut mark in block.marks {
                    mark.start += offset;
                    mark.end += offset;
                    previous.marks.push(mark);
                }
                continue;
            }
        }
        blocks.push(block);
    }
    merged.blocks = blocks;
    merged
}

fn block_to_json(block: &Block) -> Option<Value> {
    if matches!(block.kind, BlockKind::Raw(_) | BlockKind::Image) {
        return block.raw.clone();
    }
    if block.kind == BlockKind::Table {
        return block.table.as_ref().map(table_to_json);
    }
    match block.kind {
        BlockKind::Heading(level) => {
            let mut node = paragraph_node(block, None).unwrap_or_else(|| json!({ "type": "paragraph" }));
            node["type"] = json!("heading");
            let mut attrs = json!({ "level": level.clamp(1, 4) });
            if block.align != TextAlign::Left {
                attrs["textAlign"] = json!(block.align.as_str());
            }
            node["attrs"] = attrs;
            Some(node)
        }
        BlockKind::Quote => {
            let child = paragraph_node(block, None)?;
            Some(json!({ "type": "blockquote", "content": [child] }))
        }
        BlockKind::Code => Some(json!({
            "type": "codeBlock",
            "attrs": { "language": null },
            "content": [{ "type": "text", "text": block.text }],
        })),
        _ => paragraph_node(block, None),
    }
}

fn paragraph_node(block: &Block, _label: Option<&str>) -> Option<Value> {
    let content = inline_json(&block.text, &block.marks);
    let mut node = if content.is_empty() {
        json!({ "type": "paragraph" })
    } else {
        json!({ "type": "paragraph", "content": content })
    };
    if block.align != TextAlign::Left {
        node["attrs"] = json!({ "textAlign": block.align.as_str() });
    }
    Some(node)
}

fn inline_json(text: &str, ranges: &[MarkRange]) -> Vec<Value> {
    if text.is_empty() {
        return Vec::new();
    }
    let mut boundaries = vec![0, text.len()];
    for range in ranges {
        if range.start < range.end && range.end <= text.len() {
            boundaries.push(range.start);
            boundaries.push(range.end);
        }
    }
    boundaries.sort_unstable();
    boundaries.dedup();

    let mut nodes = Vec::new();
    for window in boundaries.windows(2) {
        let start = window[0];
        let end = window[1];
        if start >= end {
            continue;
        }
        let marks = marks_at(ranges, start, end);
        for (index, part) in text[start..end].split('\n').enumerate() {
            if index > 0 {
                nodes.push(json!({ "type": "hardBreak" }));
            }
            if part.is_empty() {
                continue;
            }
            let names = marks.names();
            if names.is_empty() {
                nodes.push(json!({ "type": "text", "text": part }));
            } else {
                let marks_json: Vec<Value> = names
                    .into_iter()
                    .map(|name| json!({ "type": name }))
                    .collect();
                nodes.push(json!({
                    "type": "text",
                    "text": part,
                    "marks": marks_json,
                }));
            }
        }
    }
    nodes
}

fn marks_at(ranges: &[MarkRange], start: usize, end: usize) -> Marks {
    let mut marks = Marks::default();
    for range in ranges {
        if range.start <= start && range.end >= end {
            marks.bold |= range.marks.bold;
            marks.italic |= range.marks.italic;
            marks.underline |= range.marks.underline;
            marks.strike |= range.marks.strike;
            marks.code |= range.marks.code;
            marks.highlight |= range.marks.highlight;
        }
    }
    marks
}

pub fn apply_marks(block: &mut Block, start: usize, end: usize, apply: impl Fn(&mut Marks)) {
    if start >= end || end > block.text.len() {
        return;
    }
    let mut boundaries = vec![0, block.text.len()];
    for range in &block.marks {
        boundaries.push(range.start);
        boundaries.push(range.end);
    }
    boundaries.push(start);
    boundaries.push(end);
    boundaries.sort_unstable();
    boundaries.dedup();

    let mut result = Vec::new();
    for window in boundaries.windows(2) {
        let segment_start = window[0];
        let segment_end = window[1];
        if segment_start >= segment_end {
            continue;
        }
        let mut marks = marks_at(&block.marks, segment_start, segment_end);
        if segment_start >= start && segment_end <= end {
            apply(&mut marks);
        }
        if !marks.is_empty() {
            result.push(MarkRange {
                start: segment_start,
                end: segment_end,
                marks,
            });
        }
    }
    block.marks = result;
}

pub fn adjust_marks_after_edit(block: &mut Block, old_text: &str) {
    let new_text = &block.text;
    if old_text == new_text {
        return;
    }
    let old_bytes = old_text.as_bytes();
    let new_bytes = new_text.as_bytes();
    let mut prefix = 0;
    while prefix < old_bytes.len()
        && prefix < new_bytes.len()
        && old_bytes[prefix] == new_bytes[prefix]
    {
        prefix += 1;
    }
    while prefix > 0 && (!old_text.is_char_boundary(prefix) || !new_text.is_char_boundary(prefix)) {
        prefix -= 1;
    }
    let mut suffix = 0;
    while suffix < old_bytes.len().saturating_sub(prefix)
        && suffix < new_bytes.len().saturating_sub(prefix)
        && old_bytes[old_bytes.len() - 1 - suffix] == new_bytes[new_bytes.len() - 1 - suffix]
    {
        suffix += 1;
    }
    while suffix > 0
        && (!old_text.is_char_boundary(old_text.len() - suffix)
            || !new_text.is_char_boundary(new_text.len() - suffix))
    {
        suffix -= 1;
    }
    let removed_end = old_text.len().saturating_sub(suffix);
    let inserted_len = new_text.len();
    let delta = inserted_len as isize - old_text.len() as isize;

    let mut ranges = Vec::new();
    for range in &block.marks {
        let mut start = range.start;
        let mut end = range.end;
        if end <= prefix {
            // unchanged
        } else if start >= removed_end {
            start = (start as isize + delta).max(0) as usize;
            end = (end as isize + delta).max(0) as usize;
        } else {
            start = start.min(prefix);
            end = if end >= removed_end {
                (end as isize + delta).max(start as isize) as usize
            } else {
                prefix
            };
        }
        end = end.min(new_text.len());
        start = start.min(end);
        if start < end {
            ranges.push(MarkRange {
                start,
                end,
                marks: range.marks,
            });
        }
    }
    block.marks = ranges;
}
