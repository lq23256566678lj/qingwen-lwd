import type { JSONContent } from '@tiptap/core'

export interface DocMeta {
  title: string
  wordCount: number
  characterCount: number
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

export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

export const EMPTY_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}
