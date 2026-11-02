# .lwd 文档格式（v1）

`.lwd` 是轻文私有的、自包含的 JSON 文档格式。它**不兼容** `.docx`，也不是 HTML 或 Markdown 的包装。设计目标是：单文件可携带、结构可读、版本可迁移、无需外部资源目录。

- MIME 建议：`application/vnd.qingwen.lwd+json`
- 扩展名：`.lwd`
- 编码：UTF-8（读取时容忍 BOM）
- 当前版本：`1`
- JSON Schema：[`lwd-format.schema.json`](./lwd-format.schema.json)
- 示例：[`../examples/welcome.lwd`](../examples/welcome.lwd)

## 1. 外层信封

```json
{
  "format": "lwd",
  "version": 1,
  "app": "qingwen-lwd",
  "createdAt": "2026-11-01T04:30:00.000Z",
  "updatedAt": "2026-11-01T04:30:00.000Z",
  "meta": {
    "title": "欢迎使用轻文",
    "wordCount": 323,
    "characterCount": 512,
    "layout": {
      "lineHeight": 1.85,
      "margins": { "top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5 },
      "firstLineIndent": 0,
      "fontFamily": "",
      "fontSize": 16
    }
  },
  "document": {
    "type": "doc",
    "content": []
  }
}
```

| 字段 | 类型 | 必有 | 说明 |
| --- | --- | --- | --- |
| `format` | string | 是 | 固定为 `"lwd"`。缺少或不匹配会被拒绝打开。 |
| `version` | integer | 是 | 当前固定为 `1`。大于 1 时拒绝打开并提示升级应用。 |
| `app` | string | 是 | 写入方标识，当前为 `"qingwen-lwd"`，仅用于诊断。 |
| `createdAt` | string | 是 | 首次创建时间，RFC 3339 / ISO 8601 UTC。另存为时沿用原值。 |
| `updatedAt` | string | 是 | 最近一次保存时间，由 Rust 后端生成。 |
| `meta` | object | 是 | 标题、统计信息与可选页面版式。统计值仅作参考，保存时会重新计算。 |
| `document` | object | 是 | TipTap / ProseMirror 的 `doc` 节点。 |

`meta.title` 最长 200 字符；为空时后端会回退到文件名。`meta.wordCount` 的统计规则：CJK 字符按“字”，拉丁字母/数字串按“词”，标点与空白不计入；`characterCount` 为去除空白后的字符数。

`meta.layout` 是可选字段（旧文档可以没有）：

| 字段 | 类型 | 范围 | 说明 |
| --- | --- | --- | --- |
| `lineHeight` | number | 1–3 | 行高倍数。 |
| `margins` | object | 每边 0–5 cm | `{ top, bottom, left, right }`，A4 页面宽 21 cm；四边可独立设置。 |
| `firstLineIndent` | number | 0–4 | 正文段落首行缩进，单位 em；标题、列表、表格与引用不缩进。 |
| `fontFamily` | string | 预设字体或空 | 默认正文字体；空字符串表示内置字体栈。 |
| `fontSize` | number | 8–96 px | 默认正文字号。 |
| `margin` | number | 0–140 px | 旧版四边统一页边距，仅用于兼容；读取时会换算成 cm。 |

保存时由“页面设置”写入；A4 页面固定为 21 × 29.7 cm，左右各 5 cm 时正文仍有 11 cm。打开文档时优先使用文件内的版式，没有该字段则使用应用默认值。“保存为默认并应用”或工具栏的字体星标会同时更新当前标签页并保存为之后新建标签页的默认值。

## 2. document：ProseMirror JSON

`document` 是 TipTap 3（ProseMirror）的原生 JSON，编辑器直接读写它，不做二次转换。因此 `.lwd` 的节点、属性、mark 与编辑器 schema 一一对应。

### 2.1 支持的块级节点

| 节点 | 关键属性 | 说明 |
| --- | --- | --- |
| `paragraph` | `textAlign?` | 正文段落。 |
| `heading` | `level: 1–4`, `textAlign?` | 四级标题。 |
| `bulletList` / `orderedList` / `listItem` | — | 项目符号 / 编号列表，可嵌套。 |
| `blockquote` | — | 引用块。 |
| `codeBlock` | `language?` | 代码块，纯文本、等宽显示，不做语法高亮。 |
| `horizontalRule` | — | 分隔线（输入 `---` 可触发）。 |
| `table` / `tableRow` / `tableHeader` / `tableCell` | `colspan`, `rowspan`, `colwidth` | 可调整列宽、合并/拆分单元格。 |
| `image` | `src`, `alt?`, `title?`, `width?`, `height?` | 图片，`src` 为 data URL；可拖拽缩放。 |
| `hardBreak` | — | 段内换行。 |

### 2.2 支持的内联 mark

| mark | 属性 | 对应按钮 |
| --- | --- | --- |
| `bold` | — | 加粗 |
| `italic` | — | 斜体 |
| `underline` | — | 下划线 |
| `strike` | — | 删除线 |
| `code` | — | 行内代码（快捷输入反引号） |
| `highlight` | `color` | 高亮 |
| `textStyle` | `color`, `fontFamily`, `fontSize` | 字体颜色 / 字体 / 字号 |
| `link` | `href`, `target`, `rel` | 链接（不在应用内直接打开） |

### 2.3 文本与样式示例

```json
{
  "type": "paragraph",
  "attrs": { "textAlign": "left" },
  "content": [
    { "type": "text", "text": "普通文字，" },
    {
      "type": "text",
      "text": "加粗",
      "marks": [{ "type": "bold" }]
    },
    {
      "type": "text",
      "text": "高亮",
      "marks": [{ "type": "highlight", "attrs": { "color": "#fff3a3" } }]
    },
    {
      "type": "text",
      "text": "红色 18px",
      "marks": [
        {
          "type": "textStyle",
          "attrs": { "color": "#b42318", "fontSize": "18px" }
        }
      ]
    }
  ]
}
```

### 2.4 表格示例

```json
{
  "type": "table",
  "content": [
    {
      "type": "tableRow",
      "content": [
        {
          "type": "tableHeader",
          "attrs": { "colspan": 1, "rowspan": 1, "colwidth": null },
          "content": [
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "操作" }]
            }
          ]
        }
      ]
    }
  ]
}
```

表格单元格的内容必须是块节点（通常是 `paragraph`）。`colwidth` 为列宽像素数组或 `null`；拖拽列宽后由 TipTap 写入。

### 2.5 图片示例

```json
{
  "type": "image",
  "attrs": {
    "src": "data:image/png;base64,iVBORw0KGgo...",
    "alt": "轻文图标",
    "title": "轻文",
    "width": 112,
    "height": 112
  }
}
```

图片以 data URL 内嵌，文档是自包含的：移动、复制、邮件附件都不会丢图。代价是文件体积约增加 33%（Base64 膨胀），因此：

- 单张源图上限 12 MB；
- 前端会把最长边压到 1600 px（GIF 保持原样，避免动画变静帧）；
- 仅接受 PNG / JPEG / WebP / GIF，**拒绝 SVG**（避免脚本与外部引用风险）；
- 整个 `.lwd` 文件上限 128 MB。

## 3. 版本与兼容策略

1. 读取时先检查 `format` 与 `version`，任一不符立即报错，不尝试“猜”结构。
2. `version` 大于当前支持值时拒绝打开，避免新版本节点被旧版本静默丢弃。
3. 新增可选字段 / 新 mark 时递增次版本号（本文件仍为 v1）；破坏性变更递增主版本号并提供迁移器。
4. 未知的**顶层**字段在读取时被忽略，重新保存时不会保留（当前实现不承诺无损往返未知扩展）。未知**文档节点**会因加载校验失败而报错，而不是静默删除。
5. 标题、统计信息丢失可由正文重建；正文节点不可丢，因此采用严格模式（`errorOnInvalidContent: true`）。

## 4. 工作区会话（标签页恢复）

从 v0.1 的多标签页版本开始，自动保存的单位是**整个工作区**，而不再是单个文档。会话快照放在系统应用数据目录的 `recovery/session.json`，使用独立信封：

```json
{
  "format": "lwd-session",
  "version": 1,
  "savedAt": "2026-11-01T04:31:02.123Z",
  "activeId": "tab-1",
  "tabs": [
    {
      "id": "tab-1",
      "parentId": null,
      "title": "笔记",
      "path": "C:\\Users\\me\\Documents\\笔记.lwd",
      "createdAt": "2026-11-01T04:20:00.000Z",
      "document": { "type": "doc", "content": [] },
      "dirty": true,
      "saveState": "dirty",
      "lastSavedAt": null,
      "expanded": true,
      "layout": { "lineHeight": 1.85, "margins": { "top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5 }, "firstLineIndent": 0, "fontFamily": "", "fontSize": 16 }
    },
    {
      "id": "tab-2",
      "parentId": "tab-1",
      "title": "子标签页",
      "path": null,
      "createdAt": null,
      "document": { "type": "doc", "content": [] },
      "dirty": false,
      "saveState": "idle",
      "lastSavedAt": null,
      "expanded": true,
      "layout": { "lineHeight": 2, "margins": { "top": 2, "bottom": 3, "left": 1.5, "right": 1.5 }, "firstLineIndent": 2, "fontFamily": "", "fontSize": 18 }
    }
  ]
}
```

- `tabs` 是扁平数组，`parentId` 指向父标签页的 `id`，`null` 表示根标签；由此可还原任意深度的竖向标签树。拖动标签页只会改 `parentId`，子树通过父指针自然跟随。
- `path` 为 `null` 表示该标签页尚未保存到文件；`dirty` 表示自上次文件保存后是否有修改。
- `layout` 是该标签页的页面版式；写入 `.lwd` 时保存到 `meta.layout`，会话恢复时原样带回。
- `document` 是该标签页最新的 ProseMirror JSON；所有标签页共用同一个会话文件。
- 会话在编辑停止约 1.1 s 后节流保存，15 s 兜底；窗口关闭/退出时还会显式 flush。
- 启动时自动恢复会话；没有有效会话时创建一个空白标签页。
- 会话与正式文件均采用“同目录临时文件 + fsync + rename”的原子写入，避免断电/崩溃留下半截 JSON。
- 旧的单文档 `lwd-draft` 草稿不再写入；升级后首次启动若没有 `session.json`，会从空白标签页开始。

## 5. 安全与校验边界

| 项目 | 限制 |
| --- | --- |
| 文件大小 | 128 MB |
| 标题长度 | 200 字符 |
| 单张图片 | 12 MB（压缩前）；内嵌后 24 M 字符 |
| 导出内容 | 64 MB |
| 路径 | 必须是绝对路径；扩展名不符时拒绝写入（无扩展名会自动补全） |
| 图片类型 | 通过文件头 magic bytes 判定，不只信任扩展名 |
| SVG | 拒绝 |
| 文件系统权限 | 只暴露专用命令，不向 WebView 开放通用 fs 权限 |

## 6. 手工验证

```bash
node scripts/validate-lwd.mjs examples/welcome.lwd
```

脚本会检查信封字段，并用与编辑器相同的 TipTap 扩展构建 schema，执行 `Node.fromJSON` + `doc.check()`，确保节点与 mark 结构合法。
