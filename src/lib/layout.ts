import type { PageLayout, PageMargins } from './types'
import { FONT_FAMILIES } from '../editor/extensions'

/** A4：21 × 29.7 cm。页边距允许 0–5 cm，5 cm 时正文宽度仍有 11 cm。 */
export const PAGE_WIDTH_CM = 21
export const PAGE_HEIGHT_CM = 29.7
export const MARGIN_MAX_CM = 5

export const DEFAULT_FONT_STACK =
  '"Calibri", "DengXian", "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif'

const FONT_FAMILY_VALUES = new Set(FONT_FAMILIES.map((option) => option.value))

export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 2.5,
  bottom: 2.5,
  left: 2.5,
  right: 2.5,
}

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  lineHeight: 1.85,
  margins: { ...DEFAULT_PAGE_MARGINS },
  firstLineIndent: 0,
  fontFamily: '',
  fontSize: 16,
}

export const LINE_HEIGHT_OPTIONS = [1.0, 1.15, 1.5, 1.75, 1.85, 2.0, 2.25, 2.5]

export const MARGIN_PRESETS = [
  { label: '极窄', value: 0.5 },
  { label: '窄', value: 1.5 },
  { label: '普通', value: 2.5 },
  { label: '宽', value: 3.5 },
  { label: '5 cm', value: 5 },
]

export const INDENT_OPTIONS = [
  { value: 0, label: '无' },
  { value: 1, label: '1 字符' },
  { value: 2, label: '2 字符' },
  { value: 3, label: '3 字符' },
]

const DEFAULT_LAYOUT_STORAGE_KEY = 'qingwen.pageLayout.default.v1'
const LEGACY_PX_PER_CM = 96 / 2.54

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function marginCm(value: unknown, fallback: number): number {
  const number = finiteNumber(value)
  if (number === null) return fallback
  return Math.round(clamp(number, 0, MARGIN_MAX_CM) * 100) / 100
}

function normalizeMargins(value: unknown): PageMargins {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  return {
    top: marginCm(source?.top, DEFAULT_PAGE_MARGINS.top),
    bottom: marginCm(source?.bottom, DEFAULT_PAGE_MARGINS.bottom),
    left: marginCm(source?.left, DEFAULT_PAGE_MARGINS.left),
    right: marginCm(source?.right, DEFAULT_PAGE_MARGINS.right),
  }
}

/**
 * 兼容旧版：旧的 `margin` 是一个 px 数值，四边统一。
 * 新格式使用 `margins: { top, bottom, left, right }`（cm）。
 */
export function normalizeLayout(value: unknown): PageLayout {
  if (!value || typeof value !== 'object') {
    return {
      lineHeight: DEFAULT_PAGE_LAYOUT.lineHeight,
      margins: { ...DEFAULT_PAGE_MARGINS },
      firstLineIndent: DEFAULT_PAGE_LAYOUT.firstLineIndent,
      fontFamily: DEFAULT_PAGE_LAYOUT.fontFamily,
      fontSize: DEFAULT_PAGE_LAYOUT.fontSize,
    }
  }

  const source = value as Partial<PageLayout> & { margin?: unknown }
  const lineHeight = finiteNumber(source.lineHeight)
  const firstLineIndent = finiteNumber(source.firstLineIndent)
  const fontSize = finiteNumber(source.fontSize)
  const fontFamily =
    typeof source.fontFamily === 'string' &&
    FONT_FAMILY_VALUES.has(source.fontFamily)
      ? source.fontFamily
      : ''

  let margins: PageMargins
  if (source.margins && typeof source.margins === 'object') {
    margins = normalizeMargins(source.margins)
  } else {
    const legacy = finiteNumber(source.margin)
    if (legacy !== null) {
      const cm =
        Math.round(clamp(legacy / LEGACY_PX_PER_CM, 0, MARGIN_MAX_CM) * 100) /
        100
      margins = { top: cm, bottom: cm, left: cm, right: cm }
    } else {
      margins = { ...DEFAULT_PAGE_MARGINS }
    }
  }

  return {
    lineHeight: clamp(lineHeight ?? DEFAULT_PAGE_LAYOUT.lineHeight, 1, 3),
    margins,
    firstLineIndent: clamp(
      firstLineIndent ?? DEFAULT_PAGE_LAYOUT.firstLineIndent,
      0,
      4,
    ),
    fontFamily,
    fontSize: Math.round(
      clamp(fontSize ?? DEFAULT_PAGE_LAYOUT.fontSize, 8, 96),
    ),
  }
}

export function cloneLayout(layout: PageLayout): PageLayout {
  return {
    lineHeight: layout.lineHeight,
    margins: { ...layout.margins },
    firstLineIndent: layout.firstLineIndent,
    fontFamily: layout.fontFamily,
    fontSize: layout.fontSize,
  }
}

export function sameLayout(a: PageLayout, b: PageLayout): boolean {
  return (
    a.lineHeight === b.lineHeight &&
    a.firstLineIndent === b.firstLineIndent &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.margins.top === b.margins.top &&
    a.margins.bottom === b.margins.bottom &&
    a.margins.left === b.margins.left &&
    a.margins.right === b.margins.right
  )
}

export function loadDefaultLayout(): PageLayout {
  if (typeof localStorage === 'undefined') {
    return cloneLayout(DEFAULT_PAGE_LAYOUT)
  }
  try {
    const raw = localStorage.getItem(DEFAULT_LAYOUT_STORAGE_KEY)
    return raw ? normalizeLayout(JSON.parse(raw)) : cloneLayout(DEFAULT_PAGE_LAYOUT)
  } catch {
    return cloneLayout(DEFAULT_PAGE_LAYOUT)
  }
}

export function saveDefaultLayout(layout: PageLayout): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      DEFAULT_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalizeLayout(layout)),
    )
  } catch {
    // localStorage 不可用时只影响“默认值”，不影响当前文档。
  }
}

export function formatLineHeight(lineHeight: number): string {
  return Number.isInteger(lineHeight)
    ? lineHeight.toFixed(1)
    : String(lineHeight)
}

export function formatCm(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}
