import {
  DEFAULT_FONT_STACK,
  DEFAULT_PAGE_LAYOUT,
  normalizeLayout,
} from './layout'
import type { DocMeta, PageLayout } from './types'

const CJK_PATTERN =
  /[\u2E80-\u2EFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g
const WORD_PATTERN = /[A-Za-z0-9]+(?:[’'_-][A-Za-z0-9]+)*/g

/**
 * 中文按“字”统计，拉丁文按“词”统计，符合中文用户对“字数”的直觉。
 * 标点与空白不计入字数，字符数则去掉所有空白。
 */
export function countText(text: string): { words: number; characters: number } {
  const cjkCount = text.match(CJK_PATTERN)?.length ?? 0
  const withoutCjk = text.replace(CJK_PATTERN, ' ')
  const wordCount = withoutCjk.match(WORD_PATTERN)?.length ?? 0
  return {
    words: cjkCount + wordCount,
    characters: text.replace(/\s/g, '').length,
  }
}

export function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

export function basename(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

export function titleFromPath(path: string): string {
  return basename(path).replace(/\.lwd$/i, '') || '无标题'
}

export function ensureExtension(path: string, extension: string): string {
  const normalized = extension.startsWith('.') ? extension : `.${extension}`
  return path.toLowerCase().endsWith(normalized.toLowerCase())
    ? path
    : `${path}${normalized}`
}

export function isLwdPath(path: string): boolean {
  return /\.lwd$/i.test(path)
}

export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(path)
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildMeta(
  title: string,
  text: string,
  layout: PageLayout = DEFAULT_PAGE_LAYOUT,
): DocMeta {
  const counts = countText(text)
  return {
    title: title.trim() || '无标题',
    wordCount: counts.words,
    characterCount: counts.characters,
    layout: normalizeLayout(layout),
  }
}

/** 生成可独立打开、可直接打印的 HTML 导出文件（图片已内嵌为 data URL）。 */
export function buildStandaloneHtml(
  title: string,
  bodyHtml: string,
  inputLayout: PageLayout = DEFAULT_PAGE_LAYOUT,
): string {
  const safeTitle = escapeHtml(title || '无标题')
  const layout = normalizeLayout(inputLayout)
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #eef1f6;
    color: #24292f;
    font-family: ${layout.fontFamily || DEFAULT_FONT_STACK};
    font-size: ${layout.fontSize}px;
    line-height: ${layout.lineHeight};
  }
  main {
    width: 21cm;
    max-width: calc(100% - 32px);
    min-height: 29.7cm;
    margin: 32px auto;
    padding: ${layout.margins.top}cm ${layout.margins.right}cm ${layout.margins.bottom}cm ${layout.margins.left}cm;
    background: #fff;
    box-shadow: 0 18px 50px rgba(23, 37, 64, .10);
    box-sizing: border-box;
  }
  h1, h2, h3, h4 { line-height: 1.3; margin: 1.3em 0 .6em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.55em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1.1em; }
  p { margin: 0 0 .75em; text-indent: ${layout.firstLineIndent}em; }
  li > p, blockquote p, th p, td p { text-indent: 0; }
  ul, ol { padding-left: 1.6em; }
  blockquote {
    margin: 1em 0;
    padding: .5em 1em;
    border-left: 3px solid #cfdcf3;
    background: #f7faff;
    color: #495366;
  }
  pre {
    padding: 16px 18px;
    border-radius: 8px;
    background: #0f172a;
    color: #e2e8f0;
    overflow: auto;
    font-family: "Cascadia Code", Consolas, "Liberation Mono", monospace;
    font-size: 13.5px;
    line-height: 1.6;
  }
  code { font-family: "Cascadia Code", Consolas, "Liberation Mono", monospace; }
  :not(pre) > code {
    padding: .15em .35em;
    border-radius: 4px;
    background: #f1f5f9;
    color: #b03a48;
    font-size: .9em;
  }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; table-layout: fixed; }
  th, td { border: 1px solid #d8dee8; padding: 7px 10px; vertical-align: top; }
  th { background: #f5f8fc; text-align: left; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  mark { padding: .05em .1em; border-radius: 2px; }
  a { color: #2f6feb; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  @media print {
    @page { size: A4 portrait; margin: ${layout.margins.top}cm ${layout.margins.right}cm ${layout.margins.bottom}cm ${layout.margins.left}cm; }
    body { background: #fff; }
    main { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<main class="lwd-export">${bodyHtml}</main>
</body>
</html>
`
}
