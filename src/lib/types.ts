import type { JSONContent } from '@tiptap/core'

export interface PageMargins {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PageLayout {
  /** 行高倍数，例如 1.85 */
  lineHeight: number
  /** 页边距，单位 cm（A4 页面宽 21 cm） */
  margins: PageMargins
  /** 正文段落首行缩进（em） */
  firstLineIndent: number
  /** 默认正文字体；空字符串表示应用内置字体栈 */
  fontFamily: string
  /** 默认正文字号（px） */
  fontSize: number
}

export interface DocMeta {
  title: string
  wordCount: number
  characterCount: number
  layout?: PageLayout | null
}

export interface LoadedDocument {
  path: string
  document: JSONContent
  meta: DocMeta
  createdAt: string
  updatedAt: string
}

export interface SaveResult {
  path: string
  createdAt: string
  updatedAt: string
  bytes: number
}

export interface DraftPayload {
  savedAt: string
  filePath: string | null
  title: string
  createdAt: string
  meta: DocMeta
  document: JSONContent
}

export interface ImportedImage {
  dataUrl: string
  name: string
  mime: string
  size: number
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type ExportFormat = 'text' | 'html'
export type ToastKind = 'info' | 'success' | 'error'

export interface TabRecord {
  id: string
  parentId: string | null
  title: string
  path: string | null
  createdAt: string | null
  document: JSONContent
  dirty: boolean
  saveState: SaveState
  lastSavedAt: string | null
  expanded: boolean
  layout: PageLayout
}

export interface WorkspaceSession {
  format: 'lwd-session'
  version: 1
  savedAt: string
  activeId: string
  tabs: TabRecord[]
}

export interface SyncSettings {
  url: string
  localAutosaveSeconds: number
  cloudUploadSeconds: number
  defaultSaveDir: string
  username: string
  hasPassword: boolean
}

export interface WebDavUploadResult {
  status: number
  bytes: number
}

export type CloudState =
  | 'unconfigured'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error'

export interface CloudStatus {
  state: CloudState
  message?: string
  at?: string
}

export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

export const EMPTY_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}
