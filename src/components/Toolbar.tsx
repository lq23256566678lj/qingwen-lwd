import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code2,
  Columns3,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Rows3,
  Search,
  Settings2,
  Split,
  Star,
  Strikethrough,
  Table,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import {
  FONT_FAMILIES,
  FONT_SIZES,
} from '../editor/extensions'
import { shortcutLabel } from '../lib/platform'
import { Popover, ToolButton } from './ui'

const TEXT_COLORS = [
  '#24292f',
  '#6b7280',
  '#b42318',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0f766e',
  '#1d4ed8',
  '#6d28d9',
  '#9d174d',
]

const HIGHLIGHT_COLORS = [
  '#fff3a3',
  '#ffd8a8',
  '#ffc9c9',
  '#e9d8fd',
  '#c5f6fa',
  '#d3f9d8',
  '#f1f3f5',
  '#ffe066',
  '#fcc2d7',
]

interface ToolbarProps {
  editor: Editor
  onOpenImage: () => void
  onOpenLink: () => void
  onOpenFind: (mode: 'find' | 'replace') => void
  onOpenPageSetup: () => void
  fontDefaults: { fontFamily: string; fontSize: number }
  onSaveTextDefaults: (fontFamily: string, fontSize: number) => void
  firstLineIndent: number
  onAdjustFirstLineIndent: (delta: number) => void
}

interface SelectButtonProps {
  label: string
  width: number
  title: string
}

function SelectButton({ label, width, title }: SelectButtonProps) {
  return (
    <button
      type="button"
      className="select-trigger"
      style={{ minWidth: width }}
      title={title}
      aria-haspopup="menu"
    >
      <span className="select-label">{label}</span>
      <ChevronDown size={13} aria-hidden="true" />
    </button>
  )
}

function TableSizePicker({
  onInsert,
  close,
}: {
  onInsert: (rows: number, cols: number) => void
  close: () => void
}) {
  const [hover, setHover] = useState({ rows: 3, cols: 3 })
  return (
    <div className="table-picker">
      <div className="table-picker-grid" role="grid">
        {Array.from({ length: 6 }, (_, rowIndex) =>
          Array.from({ length: 6 }, (_, columnIndex) => {
            const rows = rowIndex + 1
            const cols = columnIndex + 1
            const active = rows <= hover.rows && cols <= hover.cols
            return (
              <button
                key={`${rows}-${cols}`}
                type="button"
                className={`table-picker-cell${active ? ' is-active' : ''}`}
                aria-label={`${rows} 行 ${cols} 列`}
                onMouseEnter={() => setHover({ rows, cols })}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onInsert(rows, cols)
                  close()
                }}
              />
            )
          }),
        )}
      </div>
      <div className="table-picker-caption">
        {hover.rows} × {hover.cols} 表格
      </div>
    </div>
  )
}

export function Toolbar({
  editor,
  onOpenImage,
  onOpenLink,
  onOpenFind,
  onOpenPageSetup,
  fontDefaults,
  onSaveTextDefaults,
  firstLineIndent,
  onAdjustFirstLineIndent,
}: ToolbarProps) {
  const [, forceUpdate] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const handler = () => forceUpdate()
    editor.on('transaction', handler)
    return () => {
      editor.off('transaction', handler)
    }
  }, [editor])

  const headingLevel = [1, 2, 3, 4].find((level) =>
    editor.isActive('heading', { level }),
  )
  const blockLabel = editor.isActive('codeBlock')
    ? '代码块'
    : editor.isActive('blockquote')
      ? '引用'
      : headingLevel
        ? `标题 ${headingLevel}`
        : '正文'

  const textStyle = editor.getAttributes('textStyle') as {
    color?: string
    fontFamily?: string
    fontSize?: string
  }
  const currentColor = textStyle.color ?? '#24292f'
  const currentHighlight =
    (editor.getAttributes('highlight') as { color?: string }).color ??
    '#fff3a3'
  const currentFontSize =
    Number.parseInt(textStyle.fontSize ?? '', 10) || fontDefaults.fontSize
  const activeFontFamily = textStyle.fontFamily ?? fontDefaults.fontFamily
  const fontFamilyOption = FONT_FAMILIES.find(
    (option) => option.value === activeFontFamily,
  )
  const fontFamilyLabel = fontFamilyOption?.label ?? '字体'

  const applyBlock = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run()
      return
    }
    const level = Number(value)
    editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()
  }

  const insertTable = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()
  }

  const tableActive = editor.isActive('table')

  return (
    <div className="toolbar" role="toolbar" aria-label="格式工具栏">
      <div className="tool-group">
        <ToolButton
          icon={Undo2}
          label="撤销"
          shortcut={shortcutLabel('Mod+Z')}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          icon={Redo2}
          label="重做"
          shortcut={shortcutLabel('Mod+Shift+Z')}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      <div className="tool-group">
        <Popover
          trigger={() => (
            <SelectButton label={blockLabel} width={86} title="段落样式" />
          )}
        >
          {(close) => (
            <div className="menu">
              {[
                { value: 'paragraph', label: '正文' },
                { value: '1', label: '标题 1' },
                { value: '2', label: '标题 2' },
                { value: '3', label: '标题 3' },
                { value: '4', label: '标题 4' },
              ].map((option) => {
                const active =
                  option.value === 'paragraph'
                    ? !headingLevel &&
                      !editor.isActive('blockquote') &&
                      !editor.isActive('codeBlock')
                    : String(headingLevel) === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`menu-item${active ? ' is-active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      applyBlock(option.value)
                      close()
                    }}
                  >
                    <span
                      className={
                        option.value === 'paragraph'
                          ? 'menu-item-text'
                          : `menu-item-text menu-heading-${option.value}`
                      }
                    >
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Popover>

        <Popover
          trigger={() => (
            <SelectButton
              label={fontFamilyLabel}
              width={78}
              title="字体"
            />
          )}
        >
          {(close) => (
            <div className="menu menu-wide">
              {FONT_FAMILIES.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`menu-item${
                    activeFontFamily === option.value ? ' is-active' : ''
                  }`}
                  style={
                    option.value ? { fontFamily: option.value } : undefined
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (option.value) {
                      editor
                        .chain()
                        .focus()
                        .setFontFamily(option.value)
                        .run()
                    } else {
                      editor.chain().focus().unsetFontFamily().run()
                    }
                    close()
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <Popover
          trigger={() => (
            <SelectButton
              label={`${currentFontSize}`}
              width={52}
              title="字号"
            />
          )}
        >
          {(close) => (
            <div className="menu menu-size">
              <button
                type="button"
                className="menu-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetFontSize().run()
                  close()
                }}
              >
                默认
              </button>
              {FONT_SIZES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`menu-item${
                    currentFontSize === option.value ? ' is-active' : ''
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .setFontSize(`${option.value}px`)
                      .run()
                    close()
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <ToolButton
          icon={Star}
          label="保存当前字体/字号为默认"
          onClick={() => {
            const attrs = editor.getAttributes('textStyle') as {
              fontFamily?: string
              fontSize?: string
            }
            onSaveTextDefaults(
              attrs.fontFamily ?? fontDefaults.fontFamily,
              Number.parseInt(attrs.fontSize ?? '', 10) ||
                fontDefaults.fontSize,
            )
          }}
        />
      </div>

      <div className="tool-group">
        <ToolButton
          icon={Bold}
          label="加粗"
          shortcut={shortcutLabel('Mod+B')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolButton
          icon={Italic}
          label="斜体"
          shortcut={shortcutLabel('Mod+I')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          icon={Underline}
          label="下划线"
          shortcut={shortcutLabel('Mod+U')}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolButton
          icon={Strikethrough}
          label="删除线"
          shortcut={shortcutLabel('Mod+Shift+X')}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />

        <Popover
          trigger={() => (
            <button
              type="button"
              className="tool-btn color-btn"
              title="字体颜色"
              aria-label="字体颜色"
            >
              <span className="color-letter">A</span>
              <span
                className="color-bar"
                style={{ backgroundColor: currentColor }}
              />
            </button>
          )}
        >
          {(close) => (
            <div className="palette">
              <div className="palette-title">字体颜色</div>
              <div className="swatch-grid">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`swatch${
                      currentColor.toLowerCase() === color.toLowerCase()
                        ? ' is-active'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`颜色 ${color}`}
                    title={color}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run()
                      close()
                    }}
                  />
                ))}
              </div>
              <div className="palette-row">
                <label className="custom-color">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(event) => {
                      editor
                        .chain()
                        .focus()
                        .setColor(event.target.value)
                        .run()
                    }}
                  />
                  自定义颜色
                </label>
                <button
                  type="button"
                  className="link-btn"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetColor().run()
                    close()
                  }}
                >
                  自动
                </button>
              </div>
            </div>
          )}
        </Popover>

        <Popover
          trigger={() => (
            <button
              type="button"
              className="tool-btn color-btn"
              title={`高亮 (${shortcutLabel('Mod+Shift+H')})`}
              aria-label="高亮"
            >
              <Highlighter size={16} strokeWidth={1.9} />
              <span
                className="color-bar"
                style={{ backgroundColor: currentHighlight }}
              />
            </button>
          )}
        >
          {(close) => (
            <div className="palette">
              <div className="palette-title">高亮</div>
              <div className="swatch-grid">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="swatch"
                    style={{ backgroundColor: color }}
                    aria-label={`高亮 ${color}`}
                    title={color}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      editor
                        .chain()
                        .focus()
                        .setHighlight({ color })
                        .run()
                      close()
                    }}
                  />
                ))}
              </div>
              <div className="palette-row">
                <button
                  type="button"
                  className="link-btn"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run()
                    close()
                  }}
                >
                  清除高亮
                </button>
              </div>
            </div>
          )}
        </Popover>
      </div>

      <div className="tool-group">
        <ToolButton
          icon={AlignLeft}
          label="左对齐"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        />
        <ToolButton
          icon={AlignCenter}
          label="居中"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        />
        <ToolButton
          icon={AlignRight}
          label="右对齐"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        />
        <ToolButton
          icon={AlignJustify}
          label="两端对齐"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        />
      </div>

      <div className="tool-group">
        <span className="group-caption">首行</span>
        <ToolButton
          icon={IndentDecrease}
          label={`减少首行缩进（当前 ${firstLineIndent} 字符）`}
          disabled={firstLineIndent <= 0}
          onClick={() => onAdjustFirstLineIndent(-1)}
        />
        <ToolButton
          icon={IndentIncrease}
          label={`增加首行缩进（当前 ${firstLineIndent} 字符）`}
          disabled={firstLineIndent >= 3}
          onClick={() => onAdjustFirstLineIndent(1)}
        />
      </div>

      <div className="tool-group">
        <ToolButton
          icon={List}
          label="项目符号列表"
          shortcut={shortcutLabel('Mod+Shift+8')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          icon={ListOrdered}
          label="编号列表"
          shortcut={shortcutLabel('Mod+Shift+7')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          icon={Quote}
          label="引用"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          icon={Code2}
          label="代码块"
          shortcut={shortcutLabel('Mod+Alt+C')}
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
      </div>

      <div className="tool-group">
        <Popover
          trigger={() => (
            <button
              type="button"
              className="tool-btn"
              title="插入表格"
              aria-label="插入表格"
            >
              <Table size={16} strokeWidth={1.9} />
              <ChevronDown size={11} aria-hidden="true" />
            </button>
          )}
        >
          {(close) => (
            <TableSizePicker onInsert={insertTable} close={close} />
          )}
        </Popover>
        <ToolButton icon={ImageIcon} label="插入图片" onClick={onOpenImage} />
        <ToolButton
          icon={Link2}
          label="插入链接"
          active={editor.isActive('link')}
          onClick={onOpenLink}
        />
      </div>

      <div className="tool-group">
        <ToolButton
          icon={Settings2}
          label="页面设置"
          onClick={onOpenPageSetup}
        />
        <ToolButton
          icon={Search}
          label="查找和替换"
          shortcut={shortcutLabel('Mod+F')}
          onClick={() => onOpenFind('find')}
        />
        <ToolButton
          icon={Eraser}
          label="清除格式"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        />
      </div>

      {tableActive ? (
        <div className="tool-group table-tools">
          <span className="group-caption">表格</span>
          <button
            type="button"
            className="text-tool"
            title="在下方插入行"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows3 size={13} /> 行
            <Plus size={10} />
          </button>
          <button
            type="button"
            className="text-tool"
            title="在右侧插入列"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns3 size={13} /> 列
            <Plus size={10} />
          </button>
          <button
            type="button"
            className="text-tool"
            title="删除当前行"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <Rows3 size={13} /> 行
            <Minus size={10} />
          </button>
          <button
            type="button"
            className="text-tool"
            title="删除当前列"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <Columns3 size={13} /> 列
            <Minus size={10} />
          </button>
          <button
            type="button"
            className="text-tool"
            title="合并单元格"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().mergeCells().run()}
          >
            合并
          </button>
          <button
            type="button"
            className="text-tool"
            title="拆分单元格"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            <Split size={13} /> 拆分
          </button>
          <button
            type="button"
            className="text-tool"
            title="切换表头行"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            表头
          </button>
          <button
            type="button"
            className="text-tool is-danger"
            title="删除表格"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 size={13} /> 删表
          </button>
        </div>
      ) : null}
    </div>
  )
}
