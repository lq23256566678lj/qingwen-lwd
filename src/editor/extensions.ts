import { Extension } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import {
  Color,
  FontFamily,
  FontSize,
  TextStyle,
} from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'

import { SearchHighlight } from './SearchHighlight'

export interface FontFamilyOption {
  label: string
  value: string
}

export interface FontSizeOption {
  label: string
  value: number
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  { label: '默认', value: '' },
  {
    label: '无衬线',
    value:
      'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
  },
  {
    label: '宋体',
    value: '"Songti SC", "SimSun", "Noto Serif CJK SC", serif',
  },
  {
    label: '黑体',
    value:
      '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  },
  {
    label: '楷体',
    value: '"Kaiti SC", "KaiTi", "STKaiti", "Noto Serif CJK SC", serif',
  },
  {
    label: '等宽',
    value:
      '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
]

export const FONT_SIZES: FontSizeOption[] = [
  { label: '12', value: 12 },
  { label: '14', value: 14 },
  { label: '16', value: 16 },
  { label: '18', value: 18 },
  { label: '20', value: 20 },
  { label: '24', value: 24 },
  { label: '28', value: 28 },
  { label: '32', value: 32 },
  { label: '40', value: 40 },
  { label: '48', value: 48 },
]

/** 少数跨平台高频快捷键，补齐 ProseMirror 默认 keymap 未覆盖的组合。 */
const LwdShortcuts = Extension.create({
  name: 'lwdShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () =>
        this.editor.chain().focus().toggleHighlight({ color: '#fff3a3' }).run(),
      'Mod-Alt-0': () => this.editor.chain().focus().setParagraph().run(),
      'Mod-y': () => this.editor.chain().focus().redo().run(),
    }
  },
})

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: {
        HTMLAttributes: { class: 'lwd-code-block' },
      },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      },
    }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({
      multicolor: true,
      HTMLAttributes: { class: 'lwd-highlight' },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      resize: {
        enabled: true,
        directions: [
          'left',
          'right',
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
        ],
        minWidth: 80,
        minHeight: 56,
        alwaysPreserveAspectRatio: true,
      },
    }),
    TableKit.configure({
      table: {
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading' ? '标题' : '开始写作…',
      showOnlyWhenEditable: true,
    }),
    SearchHighlight,
    LwdShortcuts,
  ]
}
