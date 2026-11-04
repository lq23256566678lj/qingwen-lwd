# 轻文 LWD · Native

这是轻文 LWD 的**纯 Rust 原生版本**：使用 `egui`/`eframe` 直接绘制窗口，不使用 WebView、HTML、CSS 或 JavaScript。

它和现有 Tauri 版并存，目标是在原生 GUI 中逐步对齐 `.lwd` 文档能力和编辑功能。

## 当前阶段

第一阶段已经可运行：

- 纯 Rust 原生窗口，无 WebView
- 多标签页、新建/关闭/切换
- 打开、保存 `.lwd`（JSON v1，与 Tauri 版同一信封格式）
- 段落、标题 1–3、项目符号、编号列表、引用、代码块
- 行内加粗、斜体、下划线、删除线、行内代码、高亮
- 基础 A4 页面视觉、页边距/行距/字号/首行缩进设置
- 字数、字符数、当前路径、保存状态
- 自动保存（默认 60 秒）、默认保存文件夹
- 统一撤销/重做（文本、格式、块结构）
- 查找、上一个/下一个、替换当前、全部替换（高亮匹配）
- 图片插入与原生渲染（PNG/JPEG/GIF/WebP，内嵌 data URL）
- 表格原生编辑：单元格文字、加/减行、加/减列、首行表头
- WebDAV 手动上传/下载、后台自动上传（默认 300 秒）、目录 URL 设置，凭据写入系统钥匙串
- Windows NSIS 安装包（当前用户安装、快捷方式、.lwd 关联）
- 单实例：再次打开文件时复用现有窗口并新增标签页
- Word 风格 Ribbon：开始/插入/布局/表格/视图，分组按钮与页面标尺
- 页眉、页脚、页码与 PDF 页眉页脚
- 多页 A4 自动分页：按段落高度分配页面，每页独立页眉/页脚/页码
- 手动分页符（可删除标记）、垂直标尺、样式库、缩放
- 文本高度按真实字体排版测量；页眉页脚支持 {page}/{pages} 字段和首页不同
- 段落左/中/右对齐，并写入 .lwd textAlign
- 页面水印、页面边框、快捷字号
- 超长段落按页面可用高度动态拆分为分页块显示，保存时合并回单个段落
- 表格按可用高度拆分到多页，续页重复表头，保存时合并回单表
- 横向纸张、段后间距，PDF 与页面视图同步
- 图片按页面高度等比缩放，PDF 水印/页面边框
- PDF 直接嵌入文档图片，不再用占位文字
- 图片可调宽度（20%–100%）、左/中/右对齐，页面与 PDF 同步
- 页眉页脚左/中/右对齐
- 起始页码可设置
- A4 PDF 导出：按 A4 页边距自动分页，嵌入中文字体
- 直接打印：导出临时 PDF 后调用系统打印
- 页边距按 A4 比例实时应用到页面视觉
- 关闭标签页/窗口前的未保存确认
- 表格等暂未编辑的块会以只读占位显示，保存时保留原始 JSON

## 尚未完成（后续阶段）

- 精确 A4 分页/打印
- macOS/Linux 真机回归

## 构建

需要 Rust 1.85+ 和 Windows/macOS/Linux 的系统 GUI 依赖。

```bash
cd qingwen-native
cargo run --release
```

Windows 可执行文件：

```text
target/release/qingwen-native.exe
```

## 设计

- `src/model.rs`：原生文档模型、ProseMirror JSON 互转、标记范围编辑
- `src/lwd.rs`：`.lwd` 读取、原子写入、版式
- `src/app.rs`：egui 窗口、标签页、工具栏、页面、自动保存
- `src/config.rs`：默认保存目录和自动保存间隔

编辑器的每个段落是独立的 `TextEdit`，标记以字符范围保存，通过自定义 `LayoutJob` 绘制富文本；保存时转换成 ProseMirror JSON。

## 跨平台构建

仓库内的 `.github/workflows/native-build.yml` 在 Windows / macOS / Ubuntu 上分别执行：

```bash
cargo build --release --manifest-path native/Cargo.toml
```

推送 `native-v*` tag 会触发三平台构建并上传可执行文件 artifact。macOS/Linux 目前产出裸二进制，不是 `.app`/`.deb` 安装包。
