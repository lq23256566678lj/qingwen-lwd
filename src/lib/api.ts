import { invoke } from '@tauri-apps/api/core'
import type { JSONContent } from '@tiptap/core'

import type {
  DocMeta,
  DraftPayload,
  ExportFormat,
  ImportedImage,
  LoadedDocument,
  SaveResult,
} from './types'

export function readDocument(path: string): Promise<LoadedDocument> {
  return invoke<LoadedDocument>('read_document', { path })
}

export function writeDocument(
  path: string,
  document: JSONContent,
  meta: DocMeta,
  createdAt: string | null,
): Promise<SaveResult> {
  return invoke<SaveResult>('save_document', {
    path,
    document,
    meta,
    createdAt,
  })
}

export function writeDraft(
  document: JSONContent,
  meta: DocMeta,
  filePath: string | null,
  title: string,
  createdAt: string | null,
): Promise<void> {
  return invoke('save_draft', {
    document,
    meta,
    filePath,
    title,
    createdAt,
  })
}

export function readDraft(): Promise<DraftPayload | null> {
  return invoke<DraftPayload | null>('load_draft')
}

export function removeDraft(): Promise<void> {
  return invoke('clear_draft')
}

export function importImage(path: string): Promise<ImportedImage> {
  return invoke<ImportedImage>('read_image_as_data_url', { path })
}

export function exportDocument(
  path: string,
  content: string,
  format: ExportFormat,
): Promise<string> {
  return invoke<string>('export_document', { path, content, format })
}

export function quitApp(): Promise<void> {
  return invoke('quit_app')
}
