import { invoke } from '@tauri-apps/api/core'
import type { JSONContent } from '@tiptap/core'

import type {
  DocMeta,
  DraftPayload,
  ExportFormat,
  ImportedImage,
  LoadedDocument,
  SaveResult,
  SyncSettings,
  WebDavUploadResult,
  WorkspaceSession,
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

export function writeWorkspaceSession(
  session: WorkspaceSession,
): Promise<void> {
  return invoke('save_workspace_session', { session })
}

export function readWorkspaceSession(): Promise<WorkspaceSession | null> {
  return invoke<WorkspaceSession | null>('load_workspace_session')
}

export function clearWorkspaceSession(): Promise<void> {
  return invoke('clear_workspace_session')
}

export function loadSyncSettings(): Promise<SyncSettings> {
  return invoke<SyncSettings>('load_sync_settings')
}

export interface SaveSyncSettingsInput {
  url: string
  username: string
  password: string
  localAutosaveSeconds: number
  cloudUploadSeconds: number
  defaultSaveDir: string
  clearCredentials: boolean
}

export function saveSyncSettings(
  input: SaveSyncSettingsInput,
): Promise<SyncSettings> {
  return invoke<SyncSettings>('save_sync_settings', {
    url: input.url,
    username: input.username,
    password: input.password,
    localAutosaveSeconds: input.localAutosaveSeconds,
    cloudUploadSeconds: input.cloudUploadSeconds,
    defaultSaveDir: input.defaultSaveDir,
    clearCredentials: input.clearCredentials,
  })
}

export function uploadToWebDav(
  remoteUrl: string,
  document: JSONContent,
  meta: DocMeta,
  createdAt: string | null,
): Promise<WebDavUploadResult> {
  return invoke<WebDavUploadResult>('webdav_upload', {
    remoteUrl,
    document,
    meta,
    createdAt,
  })
}

export function downloadFromWebDav(
  remoteUrl: string,
): Promise<LoadedDocument> {
  return invoke<LoadedDocument>('webdav_download', { remoteUrl })
}

export function createLocalDocument(
  folder: string,
  title: string,
  document: JSONContent,
  meta: DocMeta,
): Promise<SaveResult> {
  return invoke<SaveResult>('create_local_document', {
    folder,
    title,
    document,
    meta,
  })
}

export function renameLocalDocument(
  oldPath: string,
  folder: string,
  title: string,
): Promise<string> {
  return invoke<string>('rename_local_document', {
    oldPath,
    folder,
    title,
  })
}

export function takePendingOpenFiles(): Promise<string[]> {
  return invoke<string[]>('take_pending_open_files')
}

export function repairLwdAssociation(): Promise<string> {
  return invoke<string>('repair_lwd_association')
}

export function quitApp(): Promise<void> {
  return invoke('quit_app')
}
