# 轻文 LWD

> 写作，应该轻一点。

轻文是一款基于 **Tauri 2 + Rust + React + TipTap 3** 的跨平台轻量级富文本编辑器。它把 Word 里最常用的那部分能力做得足够顺手，同时用一个自包含的 `.lwd` JSON 文件保存全部内容：文字、格式、表格和图片都在一个文件里，不依赖 Office，也不依赖资源目录。

<p align="center"><img src="assets/icon-source.png" width="120" alt="轻文图标" /></p>

## 功能一览

| 分类 | 能力 |
| --- | --- |
| 文件 | 新建、打开、保存、另存为、拖入 `.lwd` 打开、导出 UTF-8 纯文本 / 独立 HTML |
| 字符格式 | 加粗、斜体、下划线、删除线、字体、字号、字体颜色、高亮、行内代码、清除格式 |
| 段落格式 | 正文、标题 1–4、左/中/右/两端对齐、项目符号、编号列表、引用、代码块、分隔线 |
| 表格 | 6×6 网格插入、增删行/列、合并/拆分单元格、切换表头行、删除表格、拖拽调整列宽 |
| 图片 | 工具栏插入、剪贴板粘贴、拖入窗口、拖拽缩放、data URL 内嵌、自动压缩 |
| 查找替换 | 全文查找、上一个/下一个、区分大小写、单条替换、全部替换、命中计数 |
| 文档 | 字数/字符统计、未保存状态、自动保存、崩溃恢复草稿、关闭前保存提醒 |
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
│  ├─ icon-source.png            # 1024×1024 应用图标源文件
│  └─ sample-image.png            # 示例文档内嵌图片
├─ docs/
│  ├─ lwd-format.md               # .lwd 格式说明（信封、节点、版本、草稿）
│  ├─ lwd-format.schema.json      # JSON Schema（信封 + 宽松文档结构）
│  └─ limitations.md              # 已知限制
├─ examples/
│  └─ welcome.lwd                 # 可直接打开的示例文档（含表格/图片/代码块）
├─ scripts/
│  └─ validate-lwd.mjs            # 用编辑器同款 schema 校验 .lwd
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                     # 文档会话、自动保存、菜单/快捷键、未保存守卫
│  ├─ components/
│  │  ├─ TopBar.tsx               # 文件栏、保存状态、导出
│  │  ├─ Toolbar.tsx              # Word 风格工具栏、颜色面板、表格工具
│  │  ├─ FindReplace.tsx          # 查找替换浮层
│  │  ├─ StatusBar.tsx            # 字数、保存状态
│  │  ├─ RecoveryBanner.tsx       # 崩溃恢复提示
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
│  │  ├─ text.ts                  # 字数统计、路径处理、HTML 导出模板
│  │  ├─ image.ts                 # data URL 压缩与剪贴板图片
│  │  └─ platform.ts              # IS_MAC / IS_TAURI / 快捷键文案
│  └─ styles/
│     ├─ app.css                  # 应用外壳、工具栏、弹层、弹窗
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
      └─ storage.rs               # .lwd / 草稿 / 图片 / 导出的原子读写与校验
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

交付环境没有 MSVC / Windows SDK，因此**没有在这台机器上执行 MSVC 的 `cargo tauri build`**。已经完成的验证：

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| Vite 8 生产构建（2131 个模块） | 通过，产物约 767 KB（gzip 239 KB） |
| `cargo fmt --check` | 通过 |
| `cargo check --target x86_64-pc-windows-gnu` | 通过（Tauri 2.12.5 全量依赖） |
| `cargo build --target x86_64-pc-windows-gnu` | 通过，生成可执行文件并完成链接 |
| 示例 `.lwd` 经 TipTap schema 校验 | 通过 |
| happy-dom 挂载生产 bundle | 通过（编辑器/工具栏/24 个按钮正常渲染） |

Windows GNU 目标使用临时 MinGW + rust-lld 完成链接验证；正式交付仍建议使用 MSVC 工具链执行 `cargo tauri build`。macOS / Linux 构建需要在对应系统上执行。

## 快捷键

macOS 使用 ⌘ / ⇧ / ⌥；Windows 与 Linux 使用 Ctrl / Shift / Alt。

| 操作 | 快捷键 |
| --- | --- |
| 新建 / 打开 / 保存 / 另存为 | `Mod+N` / `Mod+O` / `Mod+S` / `Mod+Shift+S` |
| 关闭窗口 / 退出 | `Mod+W` / `Mod+Q` |
| 撤销 / 重做 | `Mod+Z` / `Mod+Shift+Z`（Windows 也支持 `Ctrl+Y`） |
| 加粗 / 斜体 / 下划线 / 删除线 | `Mod+B` / `Mod+I` / `Mod+U` / `Mod+Shift+X` |
| 高亮 | `Mod+Shift+H` |
| 标题 1–4 / 正文 | `Mod+Alt+1..4` / `Mod+Alt+0` |
| 项目符号 / 编号列表 | `Mod+Shift+8` / `Mod+Shift+7` |
| 代码块 | `Mod+Alt+C` |
| 查找 / 替换 | `Mod+F` / `Mod+H` |
| 全选 | `Mod+A` |

原生菜单中的“格式”项刻意不绑定快捷键：编辑器自身的 ProseMirror keymap 已经处理这些组合键，两者同时绑定会导致一次按键执行两次（例如撤销两步）。文件类命令同时注册了原生菜单加速键与前端兜底监听，并用 250 ms 去重避免双触发。

## 关键实现说明

### 图片处理

- 图片在插入前统一转为 data URL：工具栏选图经 Rust 读取并做文件头校验，粘贴走浏览器 `ClipboardItem`，拖入窗口走 Tauri `onDragDropEvent`。
- 最长边限制 1600 px，超过则用 canvas 重采样；过大的 JPEG/WebP 会重新编码。GIF 保持原样。
- 内嵌进 `.lwd` 的好处是单文件自包含、导出 HTML 直接可用、无需 asset protocol 与作用域配置；代价是文件体积增大约 1/3。
- SVG 被明确拒绝，避免脚本/外部引用；图片类型通过 magic bytes 判断，扩展名不可信。

### 自动保存策略

采用“双通道 + 原子写入”：

1. **草稿通道**（始终开启）：编辑停止 900 ms 后写 `appDataDir/recovery/autosave.lwd`；另有 15 s 的兜底定时器，避免连续输入时 debounce 永远不触发。用于崩溃/断电恢复。
2. **文件通道**（文档已有路径时）：编辑停止 2.4 s 后静默写回原 `.lwd`，另有 15 s 兜底。
3. **显式保存**：`Ctrl/⌘+S` 立即写入；首次保存或“另存为”弹出系统保存对话框。
4. 所有写入先写同目录临时文件、`sync_all`、再 `rename`；后端还会重新校验文档结构与大小。
5. 保存完成时比较 revision：如果保存期间又有输入，不把状态错误地标记为“已保存”。
6. 关闭窗口、新建、打开、退出前都会检查未保存状态，提供“保存并继续 / 放弃修改 / 取消”三选一；关闭事件通过 `onCloseRequested` 拦截。
7. 启动时读取草稿并显示恢复条，不自动覆盖空白文档。成功保存、放弃、新建或打开另一文档时清除草稿。

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
- 单窗口、单文档，无标签页；草稿只保留最后一份。
- 未做 macOS / Linux 实机验证；Windows 侧已用 GNU 目标完成 `cargo check` 与完整链接，但未在 MSVC 工具链执行 `cargo tauri build`（交付环境缺少 MSVC/Windows SDK），正式打包前请在目标平台复验。
- 大型文档（数万段或数十张内嵌图片）下，工具栏每个 transaction 重渲染与整篇 JSON 序列化会带来可感知延迟。

## 文档与示例

- [`.lwd` 格式说明](docs/lwd-format.md)
- [JSON Schema](docs/lwd-format.schema.json)
- [示例文档](examples/welcome.lwd)（17 个顶层节点，含表格、图片、代码块、链接）
- [已知限制](docs/limitations.md)

## License

MIT。详见 [LICENSE](LICENSE)。
