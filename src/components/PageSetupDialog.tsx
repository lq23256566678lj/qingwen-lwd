import { useEffect, useState } from 'react'

import { FONT_FAMILIES, FONT_SIZES } from '../editor/extensions'
import {
  DEFAULT_PAGE_LAYOUT,
  INDENT_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  MARGIN_MAX_CM,
  MARGIN_PRESETS,
  PAGE_HEIGHT_CM,
  PAGE_WIDTH_CM,
  formatCm,
  formatLineHeight,
  normalizeLayout,
} from '../lib/layout'
import type { PageLayout, PageMargins } from '../lib/types'
import { Modal } from './Modal'

interface PageSetupDialogProps {
  open: boolean
  layout: PageLayout
  onApply: (layout: PageLayout) => void
  onSaveDefault: (layout: PageLayout) => void
  onClose: () => void
}

const MARGIN_SIDES: Array<{ key: keyof PageMargins; label: string }> = [
  { key: 'top', label: '上' },
  { key: 'bottom', label: '下' },
  { key: 'left', label: '左' },
  { key: 'right', label: '右' },
]

export function PageSetupDialog({
  open,
  layout,
  onApply,
  onSaveDefault,
  onClose,
}: PageSetupDialogProps) {
  const [draft, setDraft] = useState<PageLayout>(() => normalizeLayout(layout))

  useEffect(() => {
    if (open) setDraft(normalizeLayout(layout))
  }, [open, layout])

  const patch = (value: Partial<PageLayout>) => {
    setDraft((current) => normalizeLayout({ ...current, ...value }))
  }

  const patchMargin = (key: keyof PageMargins, value: number) => {
    setDraft((current) =>
      normalizeLayout({
        ...current,
        margins: { ...current.margins, [key]: value },
      }),
    )
  }

  const applyPreset = (value: number) => {
    setDraft((current) =>
      normalizeLayout({
        ...current,
        margins: { top: value, bottom: value, left: value, right: value },
      }),
    )
  }

  const apply = () => {
    onApply(normalizeLayout(draft))
    onClose()
  }

  const saveDefault = () => {
    onSaveDefault(normalizeLayout(draft))
    onClose()
  }

  const presetValue = draft.margins.top
  const presetActive =
    draft.margins.top === presetValue &&
    draft.margins.bottom === presetValue &&
    draft.margins.left === presetValue &&
    draft.margins.right === presetValue
  const previewPadding = Math.min(
    38,
    Math.max(...Object.values(draft.margins)) * 7,
  )

  return (
    <Modal
      open={open}
      title="页面设置"
      subtitle={`A4 页面（${PAGE_WIDTH_CM} × ${PAGE_HEIGHT_CM} cm）。页边距可分别调整上下左右，最大 ${MARGIN_MAX_CM} cm。`}
      onClose={onClose}
      width={620}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setDraft({ ...DEFAULT_PAGE_LAYOUT })}
          >
            恢复内置值
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-ghost" onClick={apply}>
            仅应用到当前
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveDefault}
            data-autofocus
          >
            保存为默认并应用
          </button>
        </>
      }
    >
      <div className="page-setup">
        <div className="page-setup-fields">
          <label className="setup-field">
            <span className="setup-label">行距</span>
            <select
              className="setup-select"
              value={draft.lineHeight}
              onChange={(event) =>
                patch({ lineHeight: Number(event.target.value) })
              }
            >
              {LINE_HEIGHT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {formatLineHeight(value)}
                </option>
              ))}
            </select>
          </label>

          <div className="setup-inline-fields">
            <label className="setup-field">
              <span className="setup-label">默认字体</span>
              <select
                className="setup-select"
                value={draft.fontFamily}
                onChange={(event) =>
                  patch({ fontFamily: event.target.value })
                }
              >
                {FONT_FAMILIES.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="setup-field">
              <span className="setup-label">默认字号</span>
              <select
                className="setup-select"
                value={draft.fontSize}
                onChange={(event) =>
                  patch({ fontSize: Number(event.target.value) })
                }
              >
                {FONT_SIZES.some(
                  (option) => option.value === draft.fontSize,
                ) ? null : (
                  <option value={draft.fontSize}>{draft.fontSize}</option>
                )}
                {FONT_SIZES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} px
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="setup-hint">
            默认字体/字号作用于未单独设置格式的文字；工具栏仍可对选区覆盖。
          </span>

          <div className="setup-field">
            <span className="setup-label">页边距预设</span>
            <div className="setup-options" role="group" aria-label="页边距预设">
              {MARGIN_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`setup-option${
                    presetActive && presetValue === preset.value
                      ? ' is-active'
                      : ''
                  }`}
                  onClick={() => applyPreset(preset.value)}
                >
                  {preset.label}
                  <small>{formatCm(preset.value)} cm</small>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-field">
            <span className="setup-label">上下左右页边距（cm）</span>
            <div className="setup-margin-grid">
              {MARGIN_SIDES.map((side) => (
                <label className="setup-margin-field" key={side.key}>
                  <span>{side.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={MARGIN_MAX_CM}
                    step={0.1}
                    value={draft.margins[side.key]}
                    onChange={(event) =>
                      patchMargin(side.key, Number(event.target.value))
                    }
                  />
                  <input
                    type="range"
                    min={0}
                    max={MARGIN_MAX_CM}
                    step={0.1}
                    value={draft.margins[side.key]}
                    onChange={(event) =>
                      patchMargin(side.key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
            <span className="setup-hint">
              左右最大 5 cm 时，A4 正文宽度仍有 11 cm；上下边距独立于左右。
            </span>
          </div>

          <div className="setup-field">
            <span className="setup-label">首行缩进</span>
            <div className="setup-options" role="group" aria-label="首行缩进">
              {INDENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`setup-option${
                    draft.firstLineIndent === option.value ? ' is-active' : ''
                  }`}
                  onClick={() => patch({ firstLineIndent: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="setup-hint">
              只作用于正文段落；标题、列表、表格与引用不受影响。
            </span>
          </div>
        </div>

        <div className="page-setup-preview-wrap">
          <span className="setup-label">A4 预览</span>
          <div
            className="page-setup-preview"
            style={{
              padding: `${previewPadding}px`,
              lineHeight: draft.lineHeight,
              fontFamily: draft.fontFamily || undefined,
              fontSize: `${Math.max(9, Math.min(14, draft.fontSize * 0.7))}px`,
            }}
          >
            <strong>轻文 · A4</strong>
            <p
              style={{
                textIndent: `${draft.firstLineIndent}em`,
                margin: '8px 0 0',
              }}
            >
              页面 21 × 29.7 cm，当前页边距 上 {formatCm(draft.margins.top)} /
              下 {formatCm(draft.margins.bottom)} / 左{' '}
              {formatCm(draft.margins.left)} / 右 {formatCm(draft.margins.right)}{' '}
              cm。
            </p>
          </div>
        </div>
      </div>
      <p className="setup-footnote">
        当前标签页的版式会写入 `.lwd` 的 `meta.layout`，并随会话恢复；
        “保存为默认”只影响之后新建的标签页。
      </p>
    </Modal>
  )
}
