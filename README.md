# 轻文 LWD

[![build](https://github.com/lq23256566678lj/qingwen-lwd/actions/workflows/build.yml/badge.svg)](https://github.com/lq23256566678lj/qingwen-lwd/actions/workflows/build.yml)

> 写作，应该轻一点。

轻文是一款基于 **Tauri 2 + Rust + React + TipTap 3** 的跨平台轻量级富文本编辑器。它把 Word 里最常用的那部分能力做得足够顺手，同时用一个自包含的 `.lwd` JSON 文件保存全部内容：文字、格式、表格和图片都在一个文件里，不依赖 Office，也不依赖资源目录。

<p align="center"><img src="assets/icon-source.png" width="120" alt="轻文图标" /></p>

## 下载

已发布 **v0.2.1**：[GitHub Releases](https://github.com/lq23256566678lj/qingwen-lwd/releases/tag/v0.2.1)

| 平台 | 安装包 |
| --- | --- |
| Windows x64 | [安装版（NSIS）](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.2.1/Qingwen.LWD_0.2.1_x64-setup.exe) · [MSI](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.2.1/Qingwen.LWD_0.2.1_x64_en-US.msi) |
| macOS Universal | [DMG](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.2.1/Qingwen.LWD_0.2.1_universal.dmg) |
| Linux x64 | [AppImage](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.2.1/Qingwen.LWD_0.2.1_amd64.AppImage) · [DEB](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.2.1/Qingwen.LWD_0.2.1_amd64.deb) · [RPM](https://github.com/lq23256566678lj/qingwen-lwd/releases/download/v0.2.1/Qingwen.LWD-0.2.1-1.x86_64.rpm) |

安装包由 GitHub Actions 在 Windows/macOS/Linux 上构建，均未代码签名；Windows SmartScreen 与 macOS Gatekeeper 可能提示，需手动允许。Windows 便携版可由本地源码构建，不作为 Release 资产提供。

## 功能一览

| 分类 | 能力 |
| --- | --- |
| 文件 | 新建、打开、保存、另存为、拖入 `.lwd` 打开、导出 UTF-8 纯文本 / 独立 HTML |
| 字符格式 | 加粗、斜体、下划线、删除线、字体、字号、字体颜色、高亮、行内代码、清除格式 |
| 段落格式 | 正文、标题 1–4、左/中/右/两端对齐、项目符号、编号列表、引用、代码块、分隔线 |
| 表格 | 6×6 网格插入、增删行/列、合并/拆分单元格、切换表头行、删除表格、拖拽调整列宽 |
| 图片 | 工具栏插入、剪贴板粘贴、拖入窗口、拖拽缩放、data URL 内嵌、自动压缩 |
| 查找替换 | 全文查找、上一个/下一个、区分大小写、单条替换、全部替换、命中计数 |
| 标签页 | 竖向文档树、任意层级子标签页、拖拽挂到其它标签页下、双击重命名、折叠/展开、关闭子树、独立撤销栈 |
| 页面 | A4 21 × 29.7 cm；行距、上下左右页边距（0–5 cm）、默认字体/字号、正文首行缩进；工具栏可直接增减首行缩进，可保存为默认值 |
| 文档 | 字数/字符统计、未保存状态、按标签页自动保存、工作区会话恢复、关闭前保存提醒 |
| 本地保存 | 可指定默认文件夹，不使用 WebDAV 时新建/自动保存直接写入 `标题.lwd`，适合交给 OneDrive/坚果云/百度网盘同步 |
| 云盘 | WebDAV 目录同步，手动上传/下载（覆盖式），60s 本地自动保存 + 300s 云盘自动上传，凭据存入系统钥匙串 |
| 平台 | Windows / macOS / Linux 原生菜单，⌘ / Ctrl 快捷键自动适配，中文输入法友好 |

## 项目结构

```text
qingwen/
├─ index.html                     # Vite 入口
├─ package.json                   # 前端依赖与脚本
├─ pnpm-workspace.yaml            # pnpm hoisted 布局 + 构建脚本白名单
├─ tsconfig.json
├─ vite.config.ts
├─ assets/
│  └─ icon-source.png             # 1024×1024 应用图标源文件
├─ docs/
│  ├─ lwd-format.md               # .lwd 格式说明（信封、节点、版本、会话）
│  ├─ lwd-format.schema.json      # JSON Schema（信封 + 宽松文档结构）
│  ├─ cloud-sync.md               # WebDAV 同步、钥匙串与间隔说明
│  ├─ local-save.md               # 本地默认保存文件夹与文件名规则
│  └─ limitations.md              # 已知限制
├─ examples/
│  └─ welcome.lwd                 # 可直接打开的示例文档（含表格/图片/代码块）
├─ scripts/
│  └─ validate-lwd.mjs            # 用编辑器同款 schema 校验 .lwd
├─ .github/workflows/build.yml    # Windows/macOS/Linux CI 构建
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                     # 标签页会话、自动保存、菜单/快捷键、未保存守卫
│  ├─ components/
│  │  ├─ TopBar.tsx               # 文件栏、保存状态、导出
│  │  ├─ TabSidebar.tsx           # 竖向文档树、子标签页、拖拽、重命名
│  │  ├─ TabPane.tsx              # 每个标签页一个 TipTap 编辑器实例
│  │  ├─ PageSetupDialog.tsx      # 行距 / 页边距 / 首行缩进 / 字体字号
│  │  ├─ SyncSettingsDialog.tsx   # WebDAV URL、凭据、保存/上传间隔
│  │  ├─ Toolbar.tsx              # Word 风格工具栏、颜色面板、表格工具
│  │  ├─ FindReplace.tsx          # 查找替换浮层
│  │  ├─ StatusBar.tsx            # 字数、保存状态、云盘状态
│  │  ├─ Modal.tsx                # 焦点圈定 + Esc 关闭的模态框
│  │  ├─ ConfirmDialog.tsx        # 保存 / 放弃 / 取消
│  │  ├─ LinkDialog.tsx
│  │  ├─ AboutDialog.tsx
│  │  ├─ ShortcutsDialog.tsx
│  │  ├─ Toasts.tsx
│  │  └─ ui.tsx                   # ToolButton / Popover / Kbd / Spinner
│  ├─ editor/
│  │  ├─ extensions.ts            # TipTap 扩展装配、字体/字号预设
│  │  └─ SearchHighlight.ts       # ProseMirror 搜索装饰插件
│  ├─ lib/
│  │  ├─ api.ts                   # 对 Tauri invoke 的薄封装
│  │  ├─ types.ts                 # 前后端共享的 TS 类型
│  │  ├─ tabs.ts                  # 标签树、会话归一化、移动/关闭后继
│  │  ├─ layout.ts                # 页面版式默认值、校验与 localStorage
│  │  ├─ text.ts                  # 字数统计、路径处理、HTML 导出模板
│  │  ├─ image.ts                 # data URL 压缩与剪贴板图片
│  │  └─ platform.ts              # IS_MAC / IS_TAURI / 快捷键文案
│  └─ styles/
│     ├─ app.css                  # 应用外壳、标签树、工具栏、弹层
│     └─ editor.css               # 文档排版、表格、图片缩放、搜索高亮
└─ src-tauri/
   ├─ Cargo.toml
   ├─ build.rs
   ├─ tauri.conf.json             # 窗口、CSP、打包配置
   ├─ capabilities/default.json   # 最小权限：dialog + window 基础操作
   ├─ icons/                      # 各平台图标
   └─ src/
      ├─ main.rs
      ├─ lib.rs                   # 命令注册、菜单事件转发
      ├─ menu.rs                  # 原生菜单与平台快捷键
      ├─ sync.rs                  # WebDAV、同步设置、系统钥匙串凭据
      └─ storage.rs               # .lwd / 会话 / 图片 / 导出的原子读写与校验
```

## 技术选型与理由

### Tauri 2 + Rust，而不是 Electron

- 安装包通常只有几 MB 到十几 MB，内存占用明显低于 Electron；对“轻量级编辑器”这个定位很重要。
- 复用系统 WebView：Windows 用 WebView2，macOS 用 WKWebView，Linux 用 WebKitGTK。
- Rust 负责文件系统、格式校验、原子写入、图片导入和原生菜单；前端不直接拿通用文件系统权限，攻击面更小。
- 代价是三个平台 WebView 的排版与输入法行为存在差异，需要逐平台回归（见“已知限制”）。

### TipTap 3（ProseMirror），而不是自研 contenteditable / Quill / Slate

- **JSON 原生**：TipTap 的文档模型就是 ProseMirror JSON，可以直接作为 `.lwd` 的 `document` 字段，无需再做一层格式转换。
- **Schema 校验**：打开文件时可以拒绝非法节点，而不是把未知内容静默丢掉；这比“把 HTML 塞进 contenteditable”可靠得多。
- **中文输入法**：ProseMirror 对 composition 事件的处理成熟，编辑器不需要自己接管 `keydown` 插入文字；配合“组合输入期间不触发全局快捷键”即可避免绝大多数中文输入问题。
- **表格与图片**：官方扩展覆盖合并单元格、列宽拖拽、图片缩放；这些功能如果自研，工作量会迅速超过整个项目。
- **Headless**：TipTap 不带 UI，才能做出紧凑的 Word 风格工具栏，而不是套一个通用富文本皮肤。
- 对比：Lexical 性能很好，但表格/图片/IME 生态需要更多自研；Slate 更灵活但 schema 与表格要自己定义；Quill 的 Delta 模型与目标 JSON 结构不匹配，复杂表格能力弱。

### React 19 + Vite 8 + 手写 CSS

- Vite 提供快速 HMR 和简单的 Tauri 前端集成。
- 不引入组件库，工具栏密度、颜色、焦点行为和 Word 的观感可以精确控制，也减少依赖体积。
- 图标使用 tree-shake 的 `lucide-react`；CSS 只有两个文件，便于审查与替换主题。

### Rust 后端边界

前端只通过以下命令访问系统：

- `read_document` / `save_document`
- `save_draft` / `load_draft` / `clear_draft`
- `read_image_as_data_url`
- `export_document`
- `quit_app`

没有启用 `tauri-plugin-fs`，也没有把任意路径读写暴露给 WebView。文件路径必须为绝对路径，扩展名和文件头都会校验。

### 为什么是 `.lwd`，不是 docx

需求明确要求自定义 JSON 格式。实现上把 `.lwd` 设计成“信封 + ProseMirror 文档 + 元信息”，而不是直接存一个裸 doc：这样版本迁移、标题、时间戳、字数统计有稳定的落点，未来新增字段也不会污染 `document`。

## 快速开始

### 环境要求

- **Rust 1.90+**（Tauri 2.12 的 MSRV）
- **Node.js 20.19+ / 22.12+**（Vite 8 要求）
- pnpm 11+（或 npm）
- **Windows**：Visual Studio Build Tools（C++ 桌面开发）+ Windows SDK + WebView2 Runtime（Win10/11 通常自带）
- **macOS**：Xcode Command Line Tools
- **Linux**（Debian/Ubuntu 系）：

  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### 安装与开发

```bash
pnpm install
pnpm tauri dev
```

如果使用 npm：

```bash
npm install
npm run tauri dev
```

> 仓库中的 `pnpm-workspace.yaml` 固定了 `nodeLinker: hoisted`，用于避免 Windows 上 pnpm 符号链接与 Node ESM 解析的兼容问题；使用 npm 的用户可以忽略该文件。

### 构建

```bash
# 方式一：JS 版 Tauri CLI（推荐，随项目依赖安装）
pnpm tauri build

# 方式二：Cargo 版 Tauri CLI，满足 cargo tauri build 的交付要求
cargo install tauri-cli --version "^2" --locked
cargo tauri build
```

`cargo tauri build` 会执行 `tauri.conf.json` 中的 `beforeBuildCommand`（`npm run build`），因此请先安装前端依赖，并确保 `npm` 在 PATH 中。

- 只验证编译、不打安装包：`cargo tauri build --no-bundle`
- Windows 只打 NSIS：`cargo tauri build --bundles nsis`
- 首次打包 MSI/NSIS 时 Tauri 会下载 WiX/NSIS 工具，需要网络。

### 前端独立构建与校验

```bash
pnpm build
node scripts/validate-lwd.mjs examples/welcome.lwd
# 或
pnpm validate:lwd
```

### 构建验证状态

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| Vite 8 生产构建（2136 个模块） | 通过，产物约 804 KB（gzip 251 KB） |
| `cargo fmt --check` | 通过 |
| 本地 MSVC `cargo check` | 通过（Tauri 2.12.5 全量依赖） |
| 本地 MSVC `cargo test --release --lib` | 通过（本地文档创建/同名编号/重命名/标题元数据） |
| 本地 MSVC `pnpm tauri build --bundles nsis` | 通过，生成 NSIS 安装包 |
| GitHub Actions · windows-latest（MSVC） | 通过，产出 NSIS + MSI 安装包 |
| GitHub Actions · macos-latest | 通过，产出 universal DMG |
| GitHub Actions · ubuntu-22.04 | 通过，产出 AppImage / DEB / RPM |
| 示例 `.lwd` 经 TipTap schema 校验 | 通过 |
| happy-dom 挂载生产 bundle | 通过（云盘未配置状态、同步设置、默认保存文件夹、上传/下载入口正常） |

本次交付机器已经安装 Rust 与 MSVC Build Tools，Windows 发布版由本地 `pnpm tauri build` 直接构建；macOS / Linux 产物来自 GitHub Actions（见 [Actions](https://github.com/lq23256566678lj/qingwen-lwd/actions)）。

## 竖向标签页

窗口左侧是“文档树”，所有标签页竖向排列：

- 顶栏 **＋** 或侧栏底部“新标签”创建根标签页。
- 鼠标移到任意标签页行，点击 **＋** 在该标签页下创建子标签页；子标签页还可以继续创建子标签页，层级不限。
- 点击标签页标题切换；双击标题重命名；按 `F2` 也可以重命名。
- 有子标签页时，标题前的箭头可以折叠/展开；打开子标签页会自动展开父级。
- 行尾 **×** 关闭该标签页；如果它包含子标签页，会连同整棵子树一起关闭，并先检查所有未保存内容。
- 每个标签页拥有独立的 TipTap 实例，因此撤销栈、选区和滚动位置互不影响。
- 直接拖动标签页行到另一个标签页行，即可把它（连同整棵子树）挂到目标标签页下；不能拖到自己的后代里，避免形成环。
- 拖动子标签页时，侧栏底部会出现“拖到这里成为根标签页”的放置区，可以把子标签页（连同子树）移回顶层。
- 关闭窗口/退出时，会对整个工作区中未保存的标签页逐个询问保存。
- 标签页树和所有标签页的最新内容会自动保存到 `recovery/session.json`，下次启动自动恢复。

## 页面设置

页面固定为 **A4（21 × 29.7 cm）**。工具栏的 **页面设置** 按钮（齿轮图标）打开版式面板：

- **行距**：1.0–2.5 倍。
- **默认字体 / 字号**：可在这里选择，也可以把光标处正在使用的字体/字号保存为默认。
- **页边距**：上、下、左、右分别可调，范围 **0–5 cm**；也可以一键使用极窄 0.5 / 窄 1.5 / 普通 2.5 / 宽 3.5 / 5 cm 预设。左右各 5 cm 时正文宽度仍有 11 cm。
- **首行缩进**：0–3 字符，只作用于正文段落；标题、列表、表格、引用和代码块不缩进。工具栏“首行”旁的两个按钮可直接按 1 字符增减，不需要打开页面设置。

两个动作：

- **仅应用到当前**：只改当前标签页，随该文档保存。
- **保存为默认并应用**：同时写入本地默认值，之后新建的标签页都用这套版式。

工具栏字体/字号右侧的 **★** 按钮会读取当前光标处实际使用的字体和字号，一键保存为默认；它同时更新当前标签页的正文基准样式。未单独设置格式的文字使用默认字体/字号，工具栏仍可对选区覆盖。

当前版式写入 `.lwd` 的 `meta.layout`，重新打开文档会恢复；旧文件只有单值 `margin` 时会自动换算成四边 cm。HTML 导出也会带上 A4 页边距、行距、默认字体/字号和首行缩进。

## 本地默认保存文件夹

不使用 WebDAV 时，可以在“保存与云盘设置”里选择一个本地文件夹：

- **新建**根/子标签页时，立即在该文件夹静默创建 `标题.lwd`，不弹保存对话框。
- 新标签页标题为 `未命名文档`，同名文件自动变成 `未命名文档 2.lwd` 等，标签页标题同步更新。
- 文件标题改变时，默认文件夹内的文件会同步重命名，并更新 `.lwd` 的 `meta.title`。
- 默认 **60 秒**检查一次有路径且未保存的标签页并异步写回；可在设置中调整或关闭。
- 应用只写本地文件，不访问网络；可以把该文件夹直接设为 OneDrive、坚果云、百度网盘的本地同步目录，由同步客户端上传。
- 仅当 WebDAV URL 为空时启用；配置了 WebDAV 后，新建文档不再自动落盘到该文件夹。

详细规则见 [`docs/local-save.md`](docs/local-save.md)。

## 云盘同步（WebDAV）

顶部“更多”菜单或状态栏云盘状态可打开设置：

- **服务器目录 URL**：WebDAV 目录，末尾 `/` 自动补全；每个文档按本地文件名或标题上传为同名 `.lwd`。
- **用户名 / 密码**：只保存到系统钥匙串（Windows Credential Manager / macOS Keychain / Linux Secret Service），`sync.json` 不包含凭据。
- **本地自动保存间隔**：默认 60 秒，0 关闭；后台异步写回本地 `.lwd`，不阻塞编辑。
- **云盘自动上传间隔**：默认 300 秒，0 关闭；只对当前标签页且只有修订号变化时上传；失败只更新状态栏，下个间隔重试。

手动操作在“更多”菜单：

- **上传当前文档到云盘**：HTTP `PUT` 覆盖远程同名文件。
- **从云盘下载并覆盖当前文档**：`GET` 后替换编辑器内容；当前标签页有本地路径时同时原子覆盖本地文件。

状态栏显示：`云盘未配置` / `云盘已配置` / `云盘同步中…` / `云盘已同步 HH:mm` / `云盘失败：原因`。点击状态栏可打开设置。

详细安全边界、文件名规则与限制见 [`docs/cloud-sync.md`](docs/cloud-sync.md)。

## 快捷键

macOS 使用 ⌘ / ⇧ / ⌥；Windows 与 Linux 使用 Ctrl / Shift / Alt。

| 操作 | 快捷键 |
| --- | --- |
| 新建 / 打开 / 保存 / 另存为 | `Mod+N` / `Mod+O` / `Mod+S` / `Mod+Shift+S` |
| 关闭当前标签页 / 退出 | `Mod+W` / `Mod+Q` |
| 撤销 / 重做 | `Mod+Z` / `Mod+Shift+Z`（Windows 也支持 `Ctrl+Y`） |
| 加粗 / 斜体 / 下划线 / 删除线 | `Mod+B` / `Mod+I` / `Mod+U` / `Mod+Shift+X` |
| 高亮 | `Mod+Shift+H` |
| 标题 1–4 / 正文 | `Mod+Alt+1..4` / `Mod+Alt+0` |
| 项目符号 / 编号列表 | `Mod+Shift+8` / `Mod+Shift+7` |
| 代码块 | `Mod+Alt+C` |
| 查找 / 替换 | `Mod+F` / `Mod+H` |
| 全选 | `Mod+A` |

原生菜单只保留“文件 / 帮助”；加粗、标题、列表、表格、查找、撤销等全部由工具栏和编辑器自身的 keymap 负责，避免同一个功能在菜单里重复出现。文件类命令同时注册了原生菜单加速键与前端兜底监听，并用 250 ms 去重避免双触发。

## 关键实现说明

### 图片处理

- 图片在插入前统一转为 data URL：工具栏选图经 Rust 读取并做文件头校验，粘贴走浏览器 `ClipboardItem`，拖入窗口走 Tauri `onDragDropEvent`。
- 最长边限制 1600 px，超过则用 canvas 重采样；过大的 JPEG/WebP 会重新编码。GIF 保持原样。
- 内嵌进 `.lwd` 的好处是单文件自包含、导出 HTML 直接可用、无需 asset protocol 与作用域配置；代价是文件体积增大约 1/3。
- SVG 被明确拒绝，避免脚本/外部引用；图片类型通过 magic bytes 判断，扩展名不可信。

### 标签页与会话恢复

- **竖向文档树**：左侧栏展示标签页，每个标签页可继续创建子标签页，层级不限；支持折叠/展开、双击重命名、关闭整棵子树。
- **每个标签页一个 TipTap 实例**：切换标签页不会重建编辑器，因此各自的 ProseMirror 撤销栈、选区和滚动位置都保留。
- **工作区会话**：标签页树与所有标签页的最新 JSON 会写入 `appDataDir/recovery/session.json`（编辑停止约 1.1 s 后节流保存，15 s 兜底）。启动时自动恢复上次的标签页树，包括未保存的草稿。
- **关闭保护**：关闭标签页、关闭窗口、退出时，会统计该子树/整个工作区中未保存的标签页，逐个保存后再继续；选择“放弃修改”则不再恢复这些内容。
- macOS/Linux 的 CI 构建与 Windows 共用同一套标签页逻辑。

### 自动保存策略

采用“会话快照 + 文件通道 + 云盘通道 + 原子写入”：

1. **会话快照**：所有标签页的树结构、标题、路径、脏状态和最新文档 JSON 写入 `recovery/session.json`；约 1.1 s 节流 + 15 s 兜底，用于崩溃/断电恢复。
2. **文件通道**（标签页已有路径时）：每隔“本地自动保存间隔”检查所有有路径且未保存的标签页并静默写回原 `.lwd`，默认 **60 秒**，可在设置中改为其他秒数或 0（关闭）；后台异步执行，不阻塞输入。
3. **云盘通道**：当前标签页有本地变更时，按“云盘自动上传间隔”上传到 WebDAV，默认 **300 秒**；与本地保存完全解耦，失败只更新状态栏并在下个间隔重试。
4. **显式保存**：`Ctrl/⌘+S` 保存当前标签页；首次保存或“另存为”弹出系统保存对话框。
5. 所有写入先写同目录临时文件、`sync_all`、再 `rename`；后端还会重新校验文档结构、会话结构与大小。
6. 保存完成时比较每个标签页的 revision：保存期间如果又有输入，不把状态错误地标记为“已保存”。
7. 关闭标签页/窗口/退出前检查未保存状态，提供“保存并继续 / 放弃修改 / 取消”三选一；窗口关闭事件通过 `onCloseRequested` 拦截。
8. 启动时读取会话快照并自动恢复标签页树；没有有效会话时打开一个空白标签页。

### 查找替换

- 用 ProseMirror 插件状态保存查询与命中范围，通过 `Decoration` 绘制高亮；搜索状态不写入文档，不会被自动保存、撤销栈或 `.lwd` 序列化污染。
- 同一文本块内跨 mark 匹配（例如“加粗文字 + 普通文字”组成的词组）可以找到；匹配不跨段落/单元格。
- 替换使用 `Transform.insertText` 的原文插入，不把替换内容当作 HTML 解析，避免 `<`、`&` 被意外解释。
- 中文输入法组合期间暂停搜索，`compositionend` 后再执行。

### 中文输入法

- 编辑器内容不受 React 控制，不在每次输入时 `setContent`；自动保存只做防抖序列化，不打断 composition。
- 全局 `keydown` 与查找面板都会检查 `isComposing` / `keyCode === 229`，组合输入期间不抢快捷键。
- 工具栏按钮 `mousedown` 阻止默认行为，避免点击按钮时选区与输入法候选框被破坏。
- 文档区域设置 `lang="zh-CN"`、关闭拼写检查，减少 WebView 的自动更正干扰。

## 已知限制

完整列表见 [`docs/limitations.md`](docs/limitations.md)，主要项：

- 不兼容 `.docx`，不提供导入/导出 Word、PDF；HTML 导出是静态页面，不含分页/页眉页脚。
- 纯文本导出会扁平化表格与列表（保留换行，不保留制表符/项目符号）。
- 查找替换为字面量匹配，不支持正则、全词匹配；匹配不跨块。
- 图片全部内嵌，文档会随图片变大；不支持 SVG、图注、图片替代文本编辑 UI。
- 表格不支持公式、单元格底色/边框自定义、行列拖拽排序、嵌套表格。
- 自动保存是“最后写入者获胜”，不处理外部程序同时修改同一文件；没有版本历史。
- 每个打开标签页保留一个 TipTap/ProseMirror 实例，标签页很多或文档很大时会占用较多内存。
- 标签树暂不支持拖拽排序或跨父级移动；层级只通过“新建子标签页”建立，可通过重命名与关闭维护。
- 会话快照包含所有打开文档的完整 JSON；如果同时打开多张内嵌图片的文档，`session.json` 会较大（上限 128 MB）。
- 单窗口应用，没有多窗口/分屏；标签页只在单个窗口内嵌套。
- macOS / Linux 已有 CI 构建产物，但未在真机上完成菜单、输入法与字体回归；Windows 安装包未签名，可能出现 SmartScreen 提示。
- 大型文档（数万段或数十张内嵌图片）下，工具栏每个 transaction 重渲染与整篇 JSON 序列化会带来可感知延迟。

## 文档与示例

- [`.lwd` 格式说明](docs/lwd-format.md)
- [JSON Schema](docs/lwd-format.schema.json)
- [示例文档](examples/welcome.lwd)（17 个顶层节点，含表格、图片、代码块、链接）
- [已知限制](docs/limitations.md)

## License

MIT。详见 [LICENSE](LICENSE)。
