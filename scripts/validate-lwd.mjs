// 校验 .lwd 文件的基本信封与 ProseMirror 文档结构。
// 用法: node scripts/validate-lwd.mjs examples/welcome.lwd
import fs from 'node:fs'

import { getSchema } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import {
  Color,
  FontFamily,
  FontSize,
  TextStyle,
} from '@tiptap/extension-text-style'
import { Node } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'

const file = process.argv[2] ?? 'examples/welcome.lwd'
const raw = fs.readFileSync(file, 'utf8')
const data = JSON.parse(raw)

const fail = (message) => {
  console.error(`✗ ${file}: ${message}`)
  process.exit(1)
}

if (data.format !== 'lwd') fail('format 必须为 "lwd"')
if (data.version !== 1) fail('version 必须为 1')
if (typeof data.app !== 'string' || !data.app) fail('缺少 app 字段')
if (typeof data.createdAt !== 'string') fail('缺少 createdAt')
if (typeof data.updatedAt !== 'string') fail('缺少 updatedAt')
if (typeof data.meta?.title !== 'string') fail('缺少 meta.title')
if (!Number.isInteger(data.meta?.wordCount)) fail('meta.wordCount 必须为整数')
if (!Number.isInteger(data.meta?.characterCount)) {
  fail('meta.characterCount 必须为整数')
}

const schema = getSchema([
  StarterKit,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image.configure({ allowBase64: true, resize: { enabled: true } }),
  TableKit,
])

let node
try {
  node = Node.fromJSON(schema, data.document)
  node.check()
} catch (error) {
  fail(`ProseMirror 文档无效：${error.message}`)
}

console.log(
  `✓ ${file}: ${node.childCount} 个顶层节点，` +
    `${data.meta.wordCount} 字，${data.meta.characterCount} 字符`,
)
