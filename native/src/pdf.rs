use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

use printpdf::*;

use crate::model::{Block, BlockKind, Document};

const A4_WIDTH_MM: f32 = 210.0;
const A4_HEIGHT_MM: f32 = 297.0;
const MM_PER_POINT: f32 = 25.4 / 72.0;

pub fn export_pdf(
    path: &Path,
    title: &str,
    document: &Document,
    _layout: &crate::model::PageLayout,
) -> Result<String, String> {
    let font_path = find_cjk_font()?;
    let layout = document.layout.clone().normalized();
    let left = layout.margins.left * 10.0;
    let right = layout.margins.right * 10.0;
    let top = layout.margins.top * 10.0;
    let bottom = layout.margins.bottom * 10.0;
    let content_width = (A4_WIDTH_MM - left - right).max(40.0);
    let usable_height = (A4_HEIGHT_MM - top - bottom).max(40.0);

    let mut pages: Vec<Vec<(String, f32)>> = Vec::new();
    let mut current: Vec<(String, f32)> = Vec::new();
    let mut y = usable_height;

    for block in &document.blocks {
        let font_size = match block.kind {
            BlockKind::Heading(level) => layout.font_size + (4.0 - level as f32).max(1.0) * 3.0,
            BlockKind::Code => layout.font_size * 0.9,
            _ => layout.font_size,
        };
        let line_height = (font_size * 1.55 * MM_PER_POINT).max(2.4);
        for line in block_lines(block, content_width, font_size) {
            if y < line_height {
                pages.push(std::mem::take(&mut current));
                y = usable_height;
            }
            current.push((line, font_size));
            y -= line_height;
        }
        let gap = (layout.font_size * MM_PER_POINT * 0.45).max(1.0);
        if y < gap {
            pages.push(std::mem::take(&mut current));
            y = usable_height;
        } else {
            y -= gap;
        }
    }
    if current.is_empty() {
        current.push((title.to_string(), layout.font_size + 6.0));
    }
    pages.push(current);

    let (doc, first_page, first_layer) =
        PdfDocument::new(title, Mm(A4_WIDTH_MM), Mm(A4_HEIGHT_MM), "Text");
    let font = doc
        .add_external_font(File::open(&font_path).map_err(|error| {
            format!("无法打开 PDF 字体 {}：{error}", font_path.display())
        })?)
        .map_err(|error| format!("无法嵌入 PDF 字体：{error}"))?;

    for (page_index, lines) in pages.iter().enumerate() {
        let (page, layer) = if page_index == 0 {
            (first_page, first_layer)
        } else {
            doc.add_page(Mm(A4_WIDTH_MM), Mm(A4_HEIGHT_MM), "Text")
        };
        let layer = doc.get_page(page).get_layer(layer);
        if !layout.header_text.is_empty() {
            layer.use_text(
                layout.header_text.as_str(),
                9.0,
                Mm(left),
                Mm(A4_HEIGHT_MM - (top * 0.45).max(4.0)),
                &font,
            );
        }
        if !layout.footer_text.is_empty() {
            layer.use_text(
                layout.footer_text.as_str(),
                9.0,
                Mm(left),
                Mm((bottom * 0.45).max(4.0)),
                &font,
            );
        }
        let page_label = format!("第 {} / {} 页", page_index + 1, pages.len());
        layer.use_text(
            page_label.as_str(),
            9.0,
            Mm(A4_WIDTH_MM - right - 32.0),
            Mm((bottom * 0.45).max(4.0)),
            &font,
        );
        let mut y = A4_HEIGHT_MM - top;
        for (line, font_size) in lines {
            let line_height = (*font_size * 1.55 * MM_PER_POINT).max(2.4);
            y -= line_height;
            layer.use_text(
                line.as_str(),
                *font_size,
                Mm(left),
                Mm(y),
                &font,
            );
        }
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("创建 PDF 目录失败：{error}"))?;
    }
    let file = File::create(path).map_err(|error| format!("创建 PDF 失败：{error}"))?;
    let mut writer = BufWriter::new(file);
    doc.save(&mut writer)
        .map_err(|error| format!("写入 PDF 失败：{error}"))?;
    Ok(format!("PDF 已导出（{} 页）", pages.len()))
}

fn find_cjk_font() -> Result<PathBuf, String> {
    let candidates = [
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\msyh.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    ];
    for path in candidates {
        if Path::new(path).is_file() {
            return Ok(PathBuf::from(path));
        }
    }
    Err("找不到可嵌入 PDF 的中文字体".to_string())
}

fn block_lines(block: &Block, width_mm: f32, font_size: f32) -> Vec<String> {
    let text = match block.kind {
        BlockKind::Image => "[图片]".to_string(),
        BlockKind::Table => block
            .table
            .as_ref()
            .map(|table| {
                table
                    .rows
                    .iter()
                    .map(|row| {
                        row.iter()
                            .map(|cell| cell.text.as_str())
                            .collect::<Vec<_>>()
                            .join(" | ")
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default(),
        BlockKind::Raw(_) => format!("[{}]", block.kind.label()),
        _ => block.text.clone(),
    };
    let max_units = (width_mm / (font_size * MM_PER_POINT * 0.95)).max(10.0);
    let mut result = Vec::new();
    for raw_line in text.split('\n') {
        if raw_line.is_empty() {
            result.push(String::new());
            continue;
        }
        let mut line = String::new();
        let mut units = 0.0_f32;
        for character in raw_line.chars() {
            let char_units = if character.is_ascii() { 0.55 } else { 1.0 };
            if units + char_units > max_units && !line.is_empty() {
                result.push(line);
                line = String::new();
                units = 0.0;
            }
            line.push(character);
            units += char_units;
        }
        if !line.is_empty() {
            result.push(line);
        }
    }
    if result.is_empty() {
        result.push(String::new());
    }
    result
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Block, BlockKind, Document};

    #[test]
    fn export_pdf_writes_a4_pdf() {
        let path = std::env::temp_dir().join(format!(
            "qingwen-native-pdf-{}.pdf",
            std::process::id()
        ));
        let mut document = Document::blank(Default::default());
        document.blocks.push(Block::new(
            1,
            BlockKind::Paragraph,
            "PDF 导出测试：中文内容。".to_string(),
        ));
        let message = export_pdf(&path, "测试", &document, &document.layout).unwrap();
        assert!(message.contains("页"));
        let bytes = std::fs::read(&path).unwrap();
        assert!(bytes.starts_with(b"%PDF"));
        assert!(bytes.len() > 500);
        let _ = std::fs::remove_file(path);
    }
}
