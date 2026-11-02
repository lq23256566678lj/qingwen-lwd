import type { Editor, EditorOptions } from '@tiptap/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AboutDialog } from './components/AboutDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { FindReplace } from './components/FindReplace'
import { LinkDialog } from './components/LinkDialog'
import { PageSetupDialog } from './components/PageSetupDialog'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import {
  SyncSettingsDialog,
  type SyncSettingsDraft,
} from './components/SyncSettingsDialog'
import { StatusBar } from './components/StatusBar'
import { TabPane } from './components/TabPane'
import { TabSidebar } from './components/TabSidebar'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
import { createEditorExtensions } from './editor/extensions'
import {
  clearWorkspaceSession,
  createLocalDocument,
  downloadFromWebDav,
  exportDocument,
  importImage,
  loadSyncSettings,
  quitApp,
  readDocument,
  readWorkspaceSession,
  renameLocalDocument,
  saveSyncSettings as apiSaveSyncSettings,
  uploadToWebDav,
  writeDocument,
  writeWorkspaceSession,
} from './lib/api'
import { imageFileToDataUrl, optimizeImageDataUrl } from './lib/image'
import {
  DEFAULT_PAGE_LAYOUT,
  loadDefaultLayout,
  normalizeLayout,
  sameLayout,
  saveDefaultLayout,
} from './lib/layout'
import { IS_MAC, IS_TAURI, IS_WINDOWS } from './lib/platform'
import {
  createBlankTab,
  createTabFromDocument,
  findNextActiveId,
  getSubtreeIds,
  getTab,
  sanitizeSessionTabs,
} from './lib/tabs'
import {
  buildMeta,
  buildStandaloneHtml,
  ensureExtension,
  isImagePath,
  isLwdPath,
  titleFromPath,
} from './lib/text'
import {
  type CloudStatus,
  type DocMeta,
  type ExportFormat,
  type PageLayout,
  type SyncSettings,
  type TabRecord,
  type ToastKind,
  type ToastMessage,
  type WorkspaceSession,
} from './lib/types'

interface SaveOptions {
  saveAs?: boolean
  quiet?: boolean
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return '未知错误'
}

function extractClipboardImages(event: ClipboardEvent): File[] {
  const data = event.clipboardData
  if (!data) return []
  const files: File[] = []
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

function safeFileName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned || '无标题'
}

function ensureExportExtension(path: string, extension: 'txt' | 'html'): string {
  const pattern = extension === 'html' ? /\.html?$/i : /\.txt$/i
  return pattern.test(path) ? path : `${path}.${extension}`
}

function pathKey(path: string): string {
  return IS_WINDOWS || IS_MAC ? path.toLowerCase() : path
}

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  url: '',
  localAutosaveSeconds: 60,
  cloudUploadSeconds: 300,
  defaultSaveDir: '',
  username: '',
  hasPassword: false,
}

function remoteFileName(tab: TabRecord): string {
  const fromPath = tab.path?.split(/[\\/]/).pop()?.trim()
  const raw = fromPath || `${safeFileName(tab.title)}.lwd`
  const stem = raw.replace(/\.lwd$/i, '') || safeFileName(tab.title)
  return `${stem}.lwd`
}

function remoteUrlForTab(tab: TabRecord, baseUrl: string): string {
  const base = baseUrl.trim()
  if (!base) return ''
  const folder = base.endsWith('/') ? base : `${base}/`
  return `${folder}${encodeURIComponent(remoteFileName(tab))}`
}

function pathInDirectory(filePath: string, directory: string): boolean {
  if (!filePath || !directory) return false
  const normalizedFile = pathKey(filePath).replaceAll('\\', '/')
  const normalizedDir = pathKey(directory)
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
  return normalizedFile.startsWith(`${normalizedDir}/`)
}

function stemFromPath(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.lwd$/i, '') || '未命名文档'
}

export default function App() {
  const defaultLayoutRef = useRef<PageLayout | null>(null)
  if (!defaultLayoutRef.current) defaultLayoutRef.current = loadDefaultLayout()
  const initialLayout = defaultLayoutRef.current

  const [tabs, setTabs] = useState<TabRecord[]>(() => [
    createBlankTab(null, initialLayout),
  ])
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [pageSetupOpen, setPageSetupOpen] = useState(false)
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(
    DEFAULT_SYNC_SETTINGS,
  )
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncSaving, setSyncSaving] = useState(false)
  const [cloudStates, setCloudStates] = useState<Record<string, CloudStatus>>(
    {},
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [find, setFind] = useState<{ mode: 'find' | 'replace' } | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [linkDialog, setLinkDialog] = useState({
    open: false,
    url: '',
    hasLink: false,
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('保存更改？')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [dragActive, setDragActive] = useState(false)

  const tabsRef = useRef(tabs)
  const activeIdRef = useRef(activeId)
  const previousActiveIdRef = useRef(activeId)
  const editorsRef = useRef<Map<string, Editor>>(new Map())
  const editorRef = useRef<Editor | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const scrollPositionsRef = useRef<Map<string, number>>(new Map())
  const revisionRef = useRef<Map<string, number>>(new Map())
  const savingRef = useRef<Map<string, Promise<boolean>>>(new Map())
  const syncSettingsRef = useRef<SyncSettings>(DEFAULT_SYNC_SETTINGS)
  const cloudStatesRef = useRef<Record<string, CloudStatus>>({})
  const uploadedRevisionRef = useRef<Map<string, number>>(new Map())
  const cloudInFlightRef = useRef<Set<string>>(new Set())
  const localDocumentTasksRef = useRef<Set<string>>(new Set())
  const ensureLocalDocumentRef = useRef<(tabId: string) => void>(() => {})
  const renameLocalRef = useRef<(tabId: string, title: string) => void>(
    () => {},
  )
  const autoUploadRef = useRef<() => void>(() => {})
  const sessionTimerRef = useRef<number | null>(null)
  const sessionWriteRef = useRef<Promise<void> | null>(null)
  const sessionReadyRef = useRef(false)
  const lastSessionErrorRef = useRef(0)
  const lastFileErrorRef = useRef(0)
  const lastActionRef = useRef<Record<string, number>>({})
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null)
  const pendingDiscardActionRef = useRef<(() => void | Promise<void>) | null>(null)
  const pendingSaveIdsRef = useRef<string[]>([])
  const closingRef = useRef(false)
  const confirmOpenRef = useRef(false)
  const toastSeqRef = useRef(0)
  const pasteImagesRef = useRef<(files: File[]) => void>(() => {})

  tabsRef.current = tabs
  activeIdRef.current = activeId
  syncSettingsRef.current = syncSettings
  cloudStatesRef.current = cloudStates

  const pushToast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = (toastSeqRef.current += 1)
    setToasts((current) => [...current.slice(-3), { id, kind, text }])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const setCloudStatus = useCallback(
    (tabId: string, status: CloudStatus) => {
      setCloudStates((current) => {
        const next = { ...current, [tabId]: status }
        cloudStatesRef.current = next
        return next
      })
    },
    [],
  )

  const commitTabs = useCallback(
    (updater: (current: TabRecord[]) => TabRecord[]) => {
      setTabs((current) => {
        const next = updater(current)
        tabsRef.current = next
        return next
      })
    },
    [],
  )

  const updateTab = useCallback(
    (id: string, patch: Partial<TabRecord>) => {
      commitTabs((current) =>
        current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
      )
    },
    [commitTabs],
  )

  const activateTab = useCallback(
    (id: string) => {
      if (!id) return
      activeIdRef.current = id
      setActiveId(id)
      setFind(null)

      const ancestors = new Set<string>()
      let cursor = getTab(tabsRef.current, id)?.parentId ?? null
      while (cursor) {
        const parent = getTab(tabsRef.current, cursor)
        if (!parent) break
        if (!parent.expanded) ancestors.add(parent.id)
        cursor = parent.parentId
      }
      if (ancestors.size > 0) {
        commitTabs((current) =>
          current.map((tab) =>
            ancestors.has(tab.id) ? { ...tab, expanded: true } : tab,
          ),
        )
      }

      const editor = editorsRef.current.get(id) ?? null
      editorRef.current = editor
      setActiveEditor(editor)
    },
    [commitTabs],
  )

  const handleEditorReady = useCallback((id: string, editor: Editor) => {
    editorsRef.current.set(id, editor)
    if (activeIdRef.current === id) {
      editorRef.current = editor
      setActiveEditor(editor)
      window.requestAnimationFrame(() => {
        if (editorRef.current === editor) editor.commands.focus('start')
      })
    }
  }, [])

  const handleEditorDestroy = useCallback((id: string) => {
    const editor = editorsRef.current.get(id)
    editorsRef.current.delete(id)
    if (editor && editorRef.current === editor) {
      editorRef.current = null
      setActiveEditor(null)
    }
  }, [])

  const buildSession = useCallback((): WorkspaceSession => {
    return {
      format: 'lwd-session',
      version: 1,
      savedAt: new Date().toISOString(),
      activeId: activeIdRef.current,
      tabs: tabsRef.current.map((tab) => ({
        ...tab,
        document: editorsRef.current.get(tab.id)?.getJSON() ?? tab.document,
      })),
    }
  }, [])

  const writeSessionNow = useCallback(async () => {
    if (!IS_TAURI || !sessionReadyRef.current) return
    if (sessionWriteRef.current) {
      await sessionWriteRef.current.catch(() => undefined)
    }
    const task = (async () => {
      try {
        await writeWorkspaceSession(buildSession())
      } catch (error) {
        const now = Date.now()
        if (now - lastSessionErrorRef.current > 30_000) {
          lastSessionErrorRef.current = now
          pushToast(`会话草稿保存失败：${errorMessage(error)}`, 'error')
        }
      }
    })()
    sessionWriteRef.current = task
    try {
      await task
    } finally {
      if (sessionWriteRef.current === task) sessionWriteRef.current = null
    }
  }, [buildSession, pushToast])

  const scheduleSession = useCallback(() => {
    if (!IS_TAURI || !sessionReadyRef.current) return
    if (sessionTimerRef.current) return
    sessionTimerRef.current = window.setTimeout(() => {
      sessionTimerRef.current = null
      void writeSessionNow()
    }, 1100)
  }, [writeSessionNow])

  const flushSession = useCallback(async () => {
    if (sessionTimerRef.current) {
      window.clearTimeout(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
    await writeSessionNow()
  }, [writeSessionNow])

  const metaForTab = useCallback((tabId: string): DocMeta => {
    const tab = getTab(tabsRef.current, tabId)
    const editor = editorsRef.current.get(tabId)
    return buildMeta(
      tab?.title ?? '无标题',
      editor?.getText({ blockSeparator: '\n' }) ?? '',
      tab?.layout ?? defaultLayoutRef.current ?? DEFAULT_PAGE_LAYOUT,
    )
  }, [])

  const performSave = useCallback(
    async (tabId: string, options: SaveOptions = {}): Promise<boolean> => {
      if (!IS_TAURI) {
        if (!options.quiet) pushToast('文件功能仅在桌面应用中可用', 'info')
        return false
      }
      const tab = getTab(tabsRef.current, tabId)
      const editor = editorsRef.current.get(tabId)
      if (!tab || !editor) {
        if (!options.quiet) pushToast('标签页尚未准备好，请稍后重试', 'error')
        return false
      }

      const existing = savingRef.current.get(tabId)
      if (existing) await existing

      const task = (async (): Promise<boolean> => {
        let target = tab.path
        const isNewPath = !target

        if (options.saveAs || !target) {
          const chosen = await saveDialog({
            title: '保存为轻文文档',
            defaultPath: target ?? `${safeFileName(tab.title)}.lwd`,
            filters: [{ name: '轻文文档', extensions: ['lwd'] }],
          })
          if (!chosen) return false
          target = ensureExtension(chosen, 'lwd')
        }
        if (!target) return false

        const revisionAtStart = revisionRef.current.get(tabId) ?? 0
        updateTab(tabId, { saveState: 'saving' })

        try {
          const result = await writeDocument(
            target,
            editor.getJSON(),
            metaForTab(tabId),
            tab.createdAt,
          )

          const patch: Partial<TabRecord> = {
            path: result.path,
            createdAt: result.createdAt,
            lastSavedAt: result.updatedAt,
          }
          if (isNewPath || options.saveAs) {
            patch.title = titleFromPath(result.path)
          }

          if ((revisionRef.current.get(tabId) ?? 0) === revisionAtStart) {
            patch.dirty = false
            patch.saveState = 'saved'
          } else {
            patch.saveState = 'dirty'
          }
          updateTab(tabId, patch)
          scheduleSession()
          return true
        } catch (error) {
          updateTab(tabId, { saveState: 'error' })
          const now = Date.now()
          if (!options.quiet || now - lastFileErrorRef.current > 30_000) {
            lastFileErrorRef.current = now
            pushToast(`保存失败：${errorMessage(error)}`, 'error')
          }
          return false
        }
      })()

      savingRef.current.set(tabId, task)
      try {
        return await task
      } finally {
        if (savingRef.current.get(tabId) === task) savingRef.current.delete(tabId)
      }
    },
    [metaForTab, pushToast, scheduleSession, updateTab],
  )

  const handleTabUpdate = useCallback(
    (tabId: string) => {
      const tab = getTab(tabsRef.current, tabId)
      if (!tab) return
      revisionRef.current.set(tabId, (revisionRef.current.get(tabId) ?? 0) + 1)
      const patch: Partial<TabRecord> = {}
      if (!tab.dirty) patch.dirty = true
      if (
        tab.saveState === 'idle' ||
        tab.saveState === 'saved' ||
        tab.saveState === 'error'
      ) {
        patch.saveState = 'dirty'
      }
      if (Object.keys(patch).length > 0) updateTab(tabId, patch)
      scheduleSession()
    },
    [scheduleSession, updateTab],
  )

  const createTab = useCallback(
    (parentId: string | null) => {
      const localMode =
        !syncSettingsRef.current.url &&
        Boolean(syncSettingsRef.current.defaultSaveDir)
      const tab = createBlankTab(
        parentId,
        defaultLayoutRef.current ?? DEFAULT_PAGE_LAYOUT,
      )
      if (localMode) tab.title = '未命名文档'
      commitTabs((current) => {
        const withExpandedParent = parentId
          ? current.map((item) =>
              item.id === parentId ? { ...item, expanded: true } : item,
            )
          : current
        return [...withExpandedParent, tab]
      })
      activateTab(tab.id)
      scheduleSession()
      if (localMode) {
        window.setTimeout(() => {
          ensureLocalDocumentRef.current(tab.id)
        }, 0)
      }
    },
    [activateTab, commitTabs, scheduleSession],
  )

  const createRootTab = useCallback(() => createTab(null), [createTab])
  const createChildTab = useCallback(
    (parentId: string) => createTab(parentId),
    [createTab],
  )

  const renameTab = useCallback(
    (id: string, title: string) => {
      const nextTitle = title.trim() || '无标题'
      const tab = getTab(tabsRef.current, id)
      updateTab(id, { title: nextTitle })
      scheduleSession()
      const settings = syncSettingsRef.current
      if (
        tab?.path &&
        !settings.url &&
        settings.defaultSaveDir &&
        pathInDirectory(tab.path, settings.defaultSaveDir)
      ) {
        renameLocalRef.current(id, nextTitle)
      }
    },
    [scheduleSession, updateTab],
  )

  const applyPageLayout = useCallback(
    (layout: PageLayout) => {
      const id = activeIdRef.current
      const tab = getTab(tabsRef.current, id)
      if (!tab) return
      const normalized = normalizeLayout(layout)
      if (sameLayout(tab.layout, normalized)) return
      revisionRef.current.set(id, (revisionRef.current.get(id) ?? 0) + 1)
      updateTab(id, {
        layout: normalized,
        dirty: true,
        saveState: tab.saveState === 'saving' ? 'saving' : 'dirty',
      })
      scheduleSession()
    },
    [scheduleSession, updateTab],
  )

  const persistDefaultLayout = useCallback(
    (layout: PageLayout) => {
      const normalized = normalizeLayout(layout)
      defaultLayoutRef.current = normalized
      saveDefaultLayout(normalized)
      applyPageLayout(normalized)
      pushToast('已保存为新建标签页的默认版式', 'success')
    },
    [applyPageLayout, pushToast],
  )

  const adjustFirstLineIndent = useCallback(
    (delta: number) => {
      const tab = getTab(tabsRef.current, activeIdRef.current)
      if (!tab) return
      const next = Math.min(
        3,
        Math.max(0, tab.layout.firstLineIndent + delta),
      )
      if (next === tab.layout.firstLineIndent) return
      applyPageLayout({ ...tab.layout, firstLineIndent: next })
    },
    [applyPageLayout],
  )

  const saveTextDefaults = useCallback(
    (fontFamily: string, fontSize: number) => {
      const tab = getTab(tabsRef.current, activeIdRef.current)
      if (!tab) return
      const normalized = normalizeLayout({
        ...tab.layout,
        fontFamily,
        fontSize,
      })
      defaultLayoutRef.current = normalized
      saveDefaultLayout(normalized)
      applyPageLayout(normalized)
      pushToast(
        `已保存默认字体/字号（${normalized.fontSize}px）；未单独设置格式的文字将使用它`,
        'success',
      )
    },
    [applyPageLayout, pushToast],
  )

  const ensureLocalDocument = useCallback(
    async (tabId: string) => {
      const settings = syncSettingsRef.current
      if (settings.url || !settings.defaultSaveDir) return
      if (localDocumentTasksRef.current.has(tabId)) return
      const tab = getTab(tabsRef.current, tabId)
      if (!tab || tab.path) return

      const revision = revisionRef.current.get(tabId) ?? 0
      const editor = editorsRef.current.get(tabId)
      localDocumentTasksRef.current.add(tabId)
      try {
        const result = await createLocalDocument(
          settings.defaultSaveDir,
          tab.title,
          editor?.getJSON() ?? tab.document,
          metaForTab(tabId),
        )
        const current = getTab(tabsRef.current, tabId)
        if (!current || current.path) return
        let finalPath = result.path
        let finalTitle = stemFromPath(result.path)
        if (current.title !== tab.title) {
          try {
            finalPath = await renameLocalDocument(
              result.path,
              settings.defaultSaveDir,
              current.title,
            )
            finalTitle = stemFromPath(finalPath)
          } catch (error) {
            finalTitle = current.title
            pushToast(
              `按新标题重命名失败：${errorMessage(error)}`,
              'error',
            )
          }
        }
        const changed = (revisionRef.current.get(tabId) ?? 0) !== revision
        updateTab(tabId, {
          title: finalTitle,
          path: finalPath,
          createdAt: result.createdAt,
          lastSavedAt: result.updatedAt,
          dirty: changed,
          saveState: changed ? 'dirty' : 'saved',
        })
        scheduleSession()
      } catch (error) {
        pushToast(`创建本地文档失败：${errorMessage(error)}`, 'error')
      } finally {
        localDocumentTasksRef.current.delete(tabId)
      }
    },
    [metaForTab, pushToast, scheduleSession, updateTab],
  )

  ensureLocalDocumentRef.current = (tabId: string) => {
    void ensureLocalDocument(tabId)
  }

  const renameLocalDocumentForTab = useCallback(
    async (tabId: string, oldPath: string, title: string) => {
      const folder = syncSettingsRef.current.defaultSaveDir
      if (!folder) return
      try {
        const nextPath = await renameLocalDocument(oldPath, folder, title)
        updateTab(tabId, {
          path: nextPath,
          title: stemFromPath(nextPath),
        })
        scheduleSession()
      } catch (error) {
        pushToast(`重命名本地文档失败：${errorMessage(error)}`, 'error')
      }
    },
    [pushToast, scheduleSession, updateTab],
  )

  renameLocalRef.current = (tabId: string, title: string) => {
    const tab = getTab(tabsRef.current, tabId)
    if (tab?.path) void renameLocalDocumentForTab(tabId, tab.path, title)
  }

  const uploadActiveToCloud = useCallback(
    async (force = false): Promise<boolean> => {
      const id = activeIdRef.current
      const settings = syncSettingsRef.current
      if (!settings.url) {
        setCloudStatus(id, { state: 'unconfigured' })
        return false
      }
      const tab = getTab(tabsRef.current, id)
      const editor = editorsRef.current.get(id)
      if (!tab || !editor) {
        setCloudStatus(id, { state: 'error', message: '当前标签页尚未准备好' })
        return false
      }
      if (cloudInFlightRef.current.has(id)) return false

      const revision = revisionRef.current.get(id) ?? 0
      if (
        !force &&
        revision <= (uploadedRevisionRef.current.get(id) ?? 0)
      ) {
        return true
      }

      cloudInFlightRef.current.add(id)
      setCloudStatus(id, { state: 'syncing' })
      try {
        await uploadToWebDav(
          remoteUrlForTab(tab, settings.url),
          editor.getJSON(),
          metaForTab(id),
          tab.createdAt,
        )
        uploadedRevisionRef.current.set(id, revision)
        setCloudStatus(id, { state: 'synced', at: new Date().toISOString() })
        return true
      } catch (error) {
        setCloudStatus(id, { state: 'error', message: errorMessage(error) })
        return false
      } finally {
        cloudInFlightRef.current.delete(id)
      }
    },
    [metaForTab, setCloudStatus],
  )

  const requestCloudUpload = useCallback(() => {
    if (!IS_TAURI) {
      pushToast('云盘功能仅在桌面应用中可用', 'info')
      return
    }
    if (!syncSettingsRef.current.url) {
      setSyncOpen(true)
      return
    }
    void uploadActiveToCloud(true)
  }, [pushToast, uploadActiveToCloud])

  const requestCloudDownload = useCallback(async () => {
    if (!IS_TAURI) {
      pushToast('云盘功能仅在桌面应用中可用', 'info')
      return
    }
    const settings = syncSettingsRef.current
    if (!settings.url) {
      setSyncOpen(true)
      return
    }

    const id = activeIdRef.current
    const tab = getTab(tabsRef.current, id)
    const editor = editorsRef.current.get(id)
    if (!tab || !editor) {
      setCloudStatus(id, { state: 'error', message: '当前标签页尚未准备好' })
      return
    }
    if (cloudInFlightRef.current.has(id)) return

    cloudInFlightRef.current.add(id)
    setCloudStatus(id, { state: 'syncing' })
    try {
      const loaded = await downloadFromWebDav(
        remoteUrlForTab(tab, settings.url),
      )
      editor.commands.setContent(loaded.document, { emitUpdate: false })
      editor.commands.focus('start')

      const layout = normalizeLayout(loaded.meta.layout ?? tab.layout)
      const nextRevision = (revisionRef.current.get(id) ?? 0) + 1
      revisionRef.current.set(id, nextRevision)

      let dirty = true
      let path = tab.path
      let lastSavedAt = tab.lastSavedAt
      let localError: string | null = null
      if (tab.path) {
        try {
          const result = await writeDocument(
            tab.path,
            loaded.document,
            loaded.meta,
            loaded.createdAt,
          )
          path = result.path
          lastSavedAt = result.updatedAt
          dirty = false
        } catch (error) {
          localError = errorMessage(error)
        }
      }

      updateTab(id, {
        title: loaded.meta.title || tab.title,
        layout,
        path,
        createdAt: loaded.createdAt,
        dirty,
        saveState: dirty ? 'dirty' : 'saved',
        lastSavedAt,
      })
      uploadedRevisionRef.current.set(id, nextRevision)
      scheduleSession()

      if (localError) {
        setCloudStatus(id, {
          state: 'error',
          message: `下载成功，但本地文件写入失败：${localError}`,
        })
      } else {
        setCloudStatus(id, { state: 'synced', at: new Date().toISOString() })
      }
    } catch (error) {
      setCloudStatus(id, { state: 'error', message: errorMessage(error) })
    } finally {
      cloudInFlightRef.current.delete(id)
    }
  }, [pushToast, scheduleSession, setCloudStatus, updateTab])

  const handleSaveSyncSettings = useCallback(
    async (draft: SyncSettingsDraft) => {
      setSyncSaving(true)
      try {
        const saved = await apiSaveSyncSettings({
          url: draft.url,
          username: draft.username,
          password: draft.password,
          localAutosaveSeconds: draft.localAutosaveSeconds,
          cloudUploadSeconds: draft.cloudUploadSeconds,
          defaultSaveDir: draft.defaultSaveDir,
          clearCredentials: draft.clearCredentials,
        })
        const previousUrl = syncSettingsRef.current.url
        syncSettingsRef.current = saved
        setSyncSettings(saved)

        if (saved.url !== previousUrl) {
          uploadedRevisionRef.current.clear()
          setCloudStates({})
          cloudStatesRef.current = {}
        }

        if (!saved.url && saved.defaultSaveDir) {
          for (const tab of tabsRef.current) {
            if (!tab.path) void ensureLocalDocument(tab.id)
          }
        }

        setSyncOpen(false)
        pushToast('云盘同步设置已保存', 'success')
      } catch (error) {
        pushToast(`保存同步设置失败：${errorMessage(error)}`, 'error')
      } finally {
        setSyncSaving(false)
      }
    },
    [ensureLocalDocument, pushToast],
  )

  autoUploadRef.current = () => {
    void uploadActiveToCloud(false)
  }

  const toggleExpand = useCallback(
    (id: string) => {
      const tab = getTab(tabsRef.current, id)
      if (!tab) return
      updateTab(id, { expanded: !tab.expanded })
      scheduleSession()
    },
    [scheduleSession, updateTab],
  )

  const moveTab = useCallback(
    (dragId: string, targetId: string) => {
      if (!dragId || !targetId || dragId === targetId) return
      const dragged = getTab(tabsRef.current, dragId)
      const target = getTab(tabsRef.current, targetId)
      if (!dragged || !target || dragged.parentId === targetId) return
      if (getSubtreeIds(tabsRef.current, dragId).includes(targetId)) return

      commitTabs((current) => {
        const rest = current.filter((tab) => tab.id !== dragId)
        const withTargetExpanded = rest.map((tab) =>
          tab.id === targetId ? { ...tab, expanded: true } : tab,
        )
        return [
          ...withTargetExpanded,
          { ...dragged, parentId: targetId, expanded: dragged.expanded },
        ]
      })
      scheduleSession()
    },
    [commitTabs, scheduleSession],
  )

  const moveTabToRoot = useCallback(
    (dragId: string) => {
      const dragged = getTab(tabsRef.current, dragId)
      if (!dragged || dragged.parentId === null) return
      commitTabs((current) => [
        ...current.filter((tab) => tab.id !== dragId),
        { ...dragged, parentId: null },
      ])
      scheduleSession()
    },
    [commitTabs, scheduleSession],
  )

  const closeTabs = useCallback(
    (ids: string[]) => {
      const removed = new Set(ids)
      for (const id of removed) {
        revisionRef.current.delete(id)
        uploadedRevisionRef.current.delete(id)
        cloudInFlightRef.current.delete(id)
      }
      setCloudStates((current) => {
        const next = { ...current }
        for (const id of removed) delete next[id]
        cloudStatesRef.current = next
        return next
      })

      const remaining = tabsRef.current.filter((tab) => !removed.has(tab.id))
      const next = findNextActiveId(
        tabsRef.current,
        removed,
        activeIdRef.current,
      )
      let blank: TabRecord | null = null
      let nextId = next
      if (remaining.length === 0) {
        blank = createBlankTab(
          null,
          defaultLayoutRef.current ?? DEFAULT_PAGE_LAYOUT,
        )
        nextId = blank.id
      }
      commitTabs(() => (blank ? [...remaining, blank] : remaining))
      if (nextId) activateTab(nextId)
      scheduleSession()
    },
    [activateTab, commitTabs, scheduleSession],
  )

  const requestCloseTab = useCallback(
    (id: string) => {
      if (confirmOpenRef.current) return
      const tab = getTab(tabsRef.current, id)
      if (!tab) return
      const subtree = getSubtreeIds(tabsRef.current, id)
      const dirty = tabsRef.current.filter(
        (item) => subtree.includes(item.id) && item.dirty,
      )
      const hasChildren = subtree.length > 1

      if (dirty.length === 0 && !hasChildren) {
        closeTabs(subtree)
        return
      }

      pendingSaveIdsRef.current = dirty.map((item) => item.id)
      pendingActionRef.current = () => closeTabs(subtree)
      pendingDiscardActionRef.current = () => closeTabs(subtree)
      setConfirmTitle(dirty.length > 0 ? '保存更改？' : '关闭标签页组？')
      setConfirmMessage(
        dirty.length > 0
          ? `「${tab.title}」${hasChildren ? `及其 ${subtree.length - 1} 个子标签页` : ''}中有 ${dirty.length} 个文档尚未保存。保存后再关闭吗？`
          : `关闭「${tab.title}」及其 ${subtree.length - 1} 个子标签页？`,
      )
      setConfirmOpen(true)
    },
    [closeTabs],
  )

  const isPristineBlank = useCallback((tab: TabRecord): boolean => {
    if (tab.path || tab.dirty || tab.title !== '无标题') return false
    const editor = editorsRef.current.get(tab.id)
    return editor ? editor.isEmpty : true
  }, [])

  const openPath = useCallback(
    async (path: string) => {
      const existing = tabsRef.current.find(
        (tab) => tab.path && pathKey(tab.path) === pathKey(path),
      )
      if (existing) {
        activateTab(existing.id)
        pushToast('该文档已在标签页中打开', 'info')
        return
      }

      try {
        const loaded = await readDocument(path)
        const tab = createTabFromDocument(loaded.document, {
          title: loaded.meta.title || titleFromPath(loaded.path),
          path: loaded.path,
          createdAt: loaded.createdAt,
          savedAt: loaded.updatedAt,
          layout: normalizeLayout(
            loaded.meta.layout ?? defaultLayoutRef.current ?? DEFAULT_PAGE_LAYOUT,
          ),
        })
        const current = tabsRef.current
        const reuseInitial =
          current.length === 1 && isPristineBlank(current[0])
        commitTabs(() => (reuseInitial ? [tab] : [...current, tab]))
        activateTab(tab.id)
        scheduleSession()
      } catch (error) {
        pushToast(`打开失败：${errorMessage(error)}`, 'error')
      }
    },
    [activateTab, commitTabs, isPristineBlank, pushToast, scheduleSession],
  )

  const requestOpen = useCallback(() => {
    if (!IS_TAURI) {
      pushToast('文件功能仅在桌面应用中可用', 'info')
      return
    }
    void (async () => {
      try {
        const chosen = await openDialog({
          title: '打开轻文文档',
          multiple: false,
          directory: false,
          filters: [{ name: '轻文文档', extensions: ['lwd'] }],
        })
        if (!chosen) return
        const path = Array.isArray(chosen) ? chosen[0] : chosen
        if (path) await openPath(path)
      } catch (error) {
        pushToast(`打开对话框失败：${errorMessage(error)}`, 'error')
      }
    })()
  }, [openPath, pushToast])

  const insertImagePath = useCallback(
    async (path: string) => {
      const current = editorRef.current
      if (!current) return
      try {
        const imported = await importImage(path)
        const optimized = await optimizeImageDataUrl(
          imported.dataUrl,
          imported.mime,
        )
        current
          .chain()
          .focus()
          .setImage({
            src: optimized,
            alt: imported.name,
            title: imported.name,
          })
          .run()
      } catch (error) {
        pushToast(`插入图片失败：${errorMessage(error)}`, 'error')
      }
    },
    [pushToast],
  )

  const insertClipboardImages = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const dataUrl = await imageFileToDataUrl(file)
          editorRef.current
            ?.chain()
            .focus()
            .setImage({ src: dataUrl, alt: file.name || '粘贴的图片' })
            .run()
        } catch (error) {
          pushToast(`插入图片失败：${errorMessage(error)}`, 'error')
        }
      }
    },
    [pushToast],
  )

  const requestInsertImage = useCallback(async () => {
    if (!IS_TAURI) {
      pushToast('文件功能仅在桌面应用中可用', 'info')
      return
    }
    try {
      const chosen = await openDialog({
        title: '插入图片',
        multiple: true,
        directory: false,
        filters: [
          {
            name: '图片',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
          },
        ],
      })
      if (!chosen) return
      const paths = Array.isArray(chosen) ? chosen : [chosen]
      for (const path of paths) {
        await insertImagePath(path)
      }
    } catch (error) {
      pushToast(`插入图片失败：${errorMessage(error)}`, 'error')
    }
  }, [insertImagePath, pushToast])

  const requestExport = useCallback(
    async (format: ExportFormat) => {
      if (!IS_TAURI) {
        pushToast('文件功能仅在桌面应用中可用', 'info')
        return
      }
      const current = editorRef.current
      const tab = getTab(tabsRef.current, activeIdRef.current)
      if (!current || !tab) return
      const extension = format === 'text' ? 'txt' : 'html'
      try {
        const chosen = await saveDialog({
          title: format === 'text' ? '导出为纯文本' : '导出为 HTML',
          defaultPath: `${safeFileName(tab.title)}.${extension}`,
          filters:
            format === 'text'
              ? [{ name: '纯文本', extensions: ['txt'] }]
              : [{ name: 'HTML', extensions: ['html', 'htm'] }],
        })
        if (!chosen) return

        const content =
          format === 'text'
            ? current.getText({ blockSeparator: '\n' })
            : buildStandaloneHtml(
                tab.title,
                current.getHTML(),
                tab.layout,
              )
        const target = ensureExportExtension(chosen, extension)
        const written = await exportDocument(target, content, format)
        pushToast(`已导出到 ${written}`, 'success')
      } catch (error) {
        pushToast(`导出失败：${errorMessage(error)}`, 'error')
      }
    },
    [pushToast],
  )

  const shutdown = useCallback(
    async (persistSession: boolean, quit: boolean) => {
      if (closingRef.current) return
      closingRef.current = true
      try {
        if (persistSession) {
          await flushSession()
        } else {
          if (sessionTimerRef.current) {
            window.clearTimeout(sessionTimerRef.current)
            sessionTimerRef.current = null
          }
          if (sessionWriteRef.current) {
            await sessionWriteRef.current.catch(() => undefined)
          }
          if (IS_TAURI) {
            await clearWorkspaceSession().catch(() => undefined)
          }
        }
        if (quit) {
          await quitApp()
        } else {
          await getCurrentWindow().destroy()
        }
      } catch (error) {
        closingRef.current = false
        pushToast(`关闭失败：${errorMessage(error)}`, 'error')
      }
    },
    [flushSession, pushToast],
  )

  const requestCloseWindow = useCallback(() => {
    if (confirmOpenRef.current || closingRef.current) return
    const dirty = tabsRef.current.filter((tab) => tab.dirty)
    if (dirty.length === 0) {
      void shutdown(true, false)
      return
    }
    pendingSaveIdsRef.current = dirty.map((tab) => tab.id)
    pendingActionRef.current = () => shutdown(true, false)
    pendingDiscardActionRef.current = () => shutdown(false, false)
    setConfirmTitle('保存所有更改？')
    setConfirmMessage(
      `有 ${dirty.length} 个标签页尚未保存。保存后关闭窗口吗？`,
    )
    setConfirmOpen(true)
  }, [shutdown])

  const requestQuit = useCallback(() => {
    if (confirmOpenRef.current || closingRef.current) return
    const dirty = tabsRef.current.filter((tab) => tab.dirty)
    if (dirty.length === 0) {
      void shutdown(true, true)
      return
    }
    pendingSaveIdsRef.current = dirty.map((tab) => tab.id)
    pendingActionRef.current = () => shutdown(true, true)
    pendingDiscardActionRef.current = () => shutdown(false, true)
    setConfirmTitle('保存所有更改？')
    setConfirmMessage(
      `有 ${dirty.length} 个标签页尚未保存。保存后退出轻文吗？`,
    )
    setConfirmOpen(true)
  }, [shutdown])

  const finishPending = useCallback(async (mode: 'save' | 'discard') => {
    setConfirmOpen(false)
    setConfirmBusy(false)
    const action =
      mode === 'discard'
        ? (pendingDiscardActionRef.current ?? pendingActionRef.current)
        : pendingActionRef.current
    pendingActionRef.current = null
    pendingDiscardActionRef.current = null
    pendingSaveIdsRef.current = []
    if (action) await action()
  }, [])

  const handleConfirmSave = useCallback(async () => {
    setConfirmBusy(true)
    const ids = pendingSaveIdsRef.current
    for (const id of ids) {
      const ok = await performSave(id)
      if (!ok) {
        setConfirmBusy(false)
        return
      }
    }
    setConfirmBusy(false)
    const stillDirty = ids.some(
      (id) => getTab(tabsRef.current, id)?.dirty,
    )
    if (stillDirty) {
      pushToast('保存期间文档发生了变化，请再次保存', 'error')
      return
    }
    await finishPending('save')
  }, [finishPending, performSave, pushToast])

  const handleConfirmDiscard = useCallback(async () => {
    setConfirmBusy(true)
    await finishPending('discard')
  }, [finishPending])

  const handleConfirmCancel = useCallback(() => {
    pendingActionRef.current = null
    pendingDiscardActionRef.current = null
    pendingSaveIdsRef.current = []
    setConfirmOpen(false)
    setConfirmBusy(false)
    closingRef.current = false
  }, [])

  const openFind = useCallback((mode: 'find' | 'replace') => {
    setFind({ mode })
    window.requestAnimationFrame(() => {
      const input =
        window.document.querySelector<HTMLInputElement>('.find-input')
      input?.focus()
      input?.select()
    })
  }, [])

  const closeFind = useCallback(() => {
    setFind(null)
  }, [])

  const openLinkDialog = useCallback(() => {
    const current = editorRef.current
    if (!current) return
    const attrs = current.getAttributes('link') as { href?: string }
    setLinkDialog({
      open: true,
      url: attrs.href ?? '',
      hasLink: current.isActive('link'),
    })
  }, [])

  const applyLink = useCallback((url: string | null) => {
    const current = editorRef.current
    if (!current) return
    if (!url) {
      current.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    if (current.isActive('link') || !current.state.selection.empty) {
      current
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run()
      return
    }
    current
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: url,
        marks: [{ type: 'link', attrs: { href: url } }],
      })
      .run()
  }, [])

  const extensions = useMemo(() => createEditorExtensions(), [])

  const editorProps = useMemo<EditorOptions['editorProps']>(
    () => ({
      attributes: {
        class: 'lwd-prose tiptap',
        lang: 'zh-CN',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
      },
      handlePaste: (_view, event) => {
        const files = extractClipboardImages(event)
        if (files.length === 0) return false
        event.preventDefault()
        pasteImagesRef.current(files)
        return true
      },
    }),
    [],
  )

  useEffect(() => {
    pasteImagesRef.current = insertClipboardImages
  }, [insertClipboardImages])

  const runActionRef = useRef<(action: string) => void>(() => {})
  runActionRef.current = (action: string) => {
    const now = performance.now()
    const previous = lastActionRef.current[action] ?? 0
    if (now - previous < 250) return
    lastActionRef.current[action] = now

    const current = editorRef.current
    switch (action) {
      case 'new':
        createRootTab()
        break
      case 'open':
        requestOpen()
        break
      case 'save':
        void performSave(activeIdRef.current)
        break
      case 'save-as':
        void performSave(activeIdRef.current, { saveAs: true })
        break
      case 'export-text':
        void requestExport('text')
        break
      case 'export-html':
        void requestExport('html')
        break
      case 'close':
        requestCloseTab(activeIdRef.current)
        break
      case 'quit':
        requestQuit()
        break
      case 'find':
        openFind('find')
        break
      case 'replace':
        openFind('replace')
        break
      case 'select-all':
        current?.chain().focus().selectAll().run()
        break
      case 'undo':
        current?.chain().focus().undo().run()
        break
      case 'redo':
        current?.chain().focus().redo().run()
        break
      case 'bold':
        current?.chain().focus().toggleBold().run()
        break
      case 'italic':
        current?.chain().focus().toggleItalic().run()
        break
      case 'underline':
        current?.chain().focus().toggleUnderline().run()
        break
      case 'strike':
        current?.chain().focus().toggleStrike().run()
        break
      case 'paragraph':
        current?.chain().focus().setParagraph().run()
        break
      case 'bullet-list':
        current?.chain().focus().toggleBulletList().run()
        break
      case 'ordered-list':
        current?.chain().focus().toggleOrderedList().run()
        break
      case 'blockquote':
        current?.chain().focus().toggleBlockquote().run()
        break
      case 'code-block':
        current?.chain().focus().toggleCodeBlock().run()
        break
      case 'clear-format':
        current?.chain().focus().unsetAllMarks().clearNodes().run()
        break
      case 'insert-table':
        current
          ?.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run()
        break
      case 'insert-image':
        void requestInsertImage()
        break
      case 'about':
        setAboutOpen(true)
        break
      case 'shortcuts':
        setShortcutsOpen(true)
        break
      default:
        if (action.startsWith('heading-')) {
          const level = Number(action.slice('heading-'.length)) as
            | 1
            | 2
            | 3
            | 4
          current?.chain().focus().setHeading({ level }).run()
        }
    }
  }

  // 恢复上次会话：标签页树 + 每个标签页的最新内容。
  useEffect(() => {
    let cancelled = false
    if (!IS_TAURI) {
      sessionReadyRef.current = true
      return
    }
    readWorkspaceSession()
      .then((session) => {
        if (cancelled) return
        const restored = sanitizeSessionTabs(session)
        if (restored) {
          tabsRef.current = restored.tabs
          activeIdRef.current = restored.activeId
          setTabs(restored.tabs)
          setActiveId(restored.activeId)
          for (const tab of restored.tabs) {
            uploadedRevisionRef.current.set(tab.id, tab.dirty ? -1 : 0)
          }
          pushToast(`已恢复 ${restored.tabs.length} 个标签页`, 'success')
        }
        sessionReadyRef.current = true
        scheduleSession()
      })
      .catch((error) => {
        if (cancelled) return
        sessionReadyRef.current = true
        scheduleSession()
        pushToast(`恢复会话失败：${errorMessage(error)}`, 'error')
      })
    return () => {
      cancelled = true
    }
  }, [pushToast, scheduleSession])

  useEffect(() => {
    if (!IS_TAURI) return
    const seconds = syncSettings.localAutosaveSeconds
    if (seconds <= 0) return
    const interval = window.setInterval(() => {
      const localMode =
        !syncSettingsRef.current.url &&
        Boolean(syncSettingsRef.current.defaultSaveDir)
      for (const tab of tabsRef.current) {
        if (tab.path && tab.dirty) {
          void performSave(tab.id, { quiet: true })
        } else if (!tab.path && localMode) {
          void ensureLocalDocument(tab.id)
        }
      }
    }, seconds * 1000)
    return () => window.clearInterval(interval)
  }, [
    ensureLocalDocument,
    performSave,
    syncSettings.defaultSaveDir,
    syncSettings.localAutosaveSeconds,
    syncSettings.url,
  ])

  useEffect(() => {
    if (!IS_TAURI) return
    let cancelled = false
    loadSyncSettings()
      .then((settings) => {
        if (cancelled) return
        syncSettingsRef.current = settings
        setSyncSettings(settings)
      })
      .catch(() => {
        // 读取失败时保持未配置状态，不影响本地编辑。
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      !IS_TAURI ||
      !syncSettings.url ||
      syncSettings.cloudUploadSeconds <= 0
    ) {
      return
    }
    const interval = window.setInterval(
      () => autoUploadRef.current(),
      syncSettings.cloudUploadSeconds * 1000,
    )
    return () => window.clearInterval(interval)
  }, [syncSettings.cloudUploadSeconds, syncSettings.url])

  useEffect(() => {
    const editor = editorsRef.current.get(activeId) ?? null
    editorRef.current = editor
    setActiveEditor(editor)
    setFind(null)
    setPageSetupOpen(false)
    setLinkDialog((current) =>
      current.open ? { ...current, open: false } : current,
    )
    if (editor) {
      window.requestAnimationFrame(() => {
        if (editorRef.current === editor) editor.commands.focus()
      })
    }

    const workspace = workspaceRef.current
    if (workspace) {
      if (previousActiveIdRef.current !== activeId) {
        scrollPositionsRef.current.set(
          previousActiveIdRef.current,
          workspace.scrollTop,
        )
        previousActiveIdRef.current = activeId
        const target = scrollPositionsRef.current.get(activeId) ?? 0
        window.requestAnimationFrame(() => {
          if (workspaceRef.current === workspace) {
            workspace.scrollTop = target
          }
        })
      }
    }
  }, [activeId])

  useEffect(() => {
    if (!sessionReadyRef.current) return
    scheduleSession()
  }, [activeId, scheduleSession, tabs])

  useEffect(() => {
    if (!IS_TAURI) return
    const interval = window.setInterval(() => {
      if (!sessionReadyRef.current) return
      void writeSessionNow()
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [writeSessionNow])

  const activeTab = getTab(tabs, activeId) ?? tabs[0]
  const activeCloudStatus: CloudStatus = !syncSettings.url
    ? { state: 'unconfigured' }
    : (cloudStates[activeId] ?? { state: 'idle' })

  useEffect(() => {
    if (!IS_TAURI) return
    const title = `${activeTab?.title ?? '轻文'}${
      activeTab?.dirty ? ' •' : ''
    } — 轻文 LWD`
    void getCurrentWindow().setTitle(title).catch(() => undefined)
  }, [activeTab?.dirty, activeTab?.title])

  useEffect(() => {
    if (!IS_TAURI) return
    let unlisten: UnlistenFn | undefined
    let disposed = false
    getCurrentWindow()
      .onDragDropEvent((event) => {
        const payload = event.payload
        if (payload.type === 'enter') {
          setDragActive(true)
        } else if (payload.type === 'leave') {
          setDragActive(false)
        } else if (payload.type === 'drop') {
          setDragActive(false)
          const paths = payload.paths
          if (paths.length === 0) return
          const lwdPath = paths.find(isLwdPath)
          if (lwdPath) {
            void openPath(lwdPath)
            return
          }
          const images = paths.filter(isImagePath)
          if (images.length > 0) {
            for (const path of images) void insertImagePath(path)
          } else {
            pushToast(
              '仅支持 .lwd 文档或 PNG/JPEG/WebP/GIF 图片',
              'info',
            )
          }
        }
      })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch((error) => {
        pushToast(`注册拖放事件失败：${errorMessage(error)}`, 'error')
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [insertImagePath, openPath, pushToast])

  useEffect(() => {
    if (!IS_TAURI) return
    let unlisten: UnlistenFn | undefined
    let disposed = false
    listen<string>('lwd://menu', (event) => {
      runActionRef.current(event.payload)
    })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch((error) => {
        pushToast(`注册菜单事件失败：${errorMessage(error)}`, 'error')
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [pushToast])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.repeat
      ) {
        return
      }
      const modifier = IS_MAC ? event.metaKey : event.ctrlKey
      if (!modifier) return
      const key = event.key.toLowerCase()
      let action: string | null = null

      if (key === 's') action = event.shiftKey ? 'save-as' : 'save'
      else if (key === 'o' && !event.shiftKey) action = 'open'
      else if (key === 'n' && !event.shiftKey) action = 'new'
      else if (key === 'f' && !event.shiftKey) action = 'find'
      else if (key === 'h' && !event.shiftKey) action = 'replace'
      else if (key === 'w' && !event.shiftKey) action = 'close'
      else if (key === 'q' && !event.shiftKey) action = 'quit'

      if (!action) return
      event.preventDefault()
      runActionRef.current(action)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    confirmOpenRef.current = confirmOpen
  }, [confirmOpen])

  useEffect(() => {
    if (!IS_TAURI) return
    let unlisten: UnlistenFn | undefined
    let disposed = false
    getCurrentWindow()
      .onCloseRequested((event) => {
        event.preventDefault()
        if (closingRef.current || confirmOpenRef.current) return
        requestCloseWindow()
      })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch(() => undefined)
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [requestCloseWindow])

  const previewMode = !IS_TAURI

  return (
    <div className="app">
      <div className="app-body">
        <TabSidebar
          tabs={tabs}
          activeId={activeId}
          open={sidebarOpen}
          onSelect={activateTab}
          onCreateRoot={createRootTab}
          onCreateChild={createChildTab}
          onClose={requestCloseTab}
          onToggleExpand={toggleExpand}
          onRename={renameTab}
          onMoveTab={moveTab}
          onMoveToRoot={moveTabToRoot}
          onToggleOpen={() => setSidebarOpen(false)}
        />

        <div className="main-column">
          <div className="toolbar-shell">
            <TopBar
              title={activeTab?.title ?? '无标题'}
              path={activeTab?.path ?? null}
              dirty={activeTab?.dirty ?? false}
              saveState={activeTab?.saveState ?? 'idle'}
              lastSavedAt={activeTab?.lastSavedAt ?? null}
              previewMode={previewMode}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((value) => !value)}
              onNewTab={createRootTab}
              onOpen={requestOpen}
              onSave={() => void performSave(activeIdRef.current)}
              onExport={(format) => void requestExport(format)}
              onToggleFind={find ? closeFind : () => openFind('find')}
              onShowShortcuts={() => setShortcutsOpen(true)}
              onShowAbout={() => setAboutOpen(true)}
              onOpenSync={() => setSyncOpen(true)}
              onCloudUpload={requestCloudUpload}
              onCloudDownload={() => void requestCloudDownload()}
            />
            {activeEditor ? (
              <Toolbar
                editor={activeEditor}
                onOpenImage={() => void requestInsertImage()}
                onOpenLink={openLinkDialog}
                onOpenFind={openFind}
                onOpenPageSetup={() => setPageSetupOpen(true)}
                fontDefaults={{
                  fontFamily: activeTab?.layout.fontFamily ?? '',
                  fontSize: activeTab?.layout.fontSize ?? 16,
                }}
                onSaveTextDefaults={saveTextDefaults}
                firstLineIndent={activeTab?.layout.firstLineIndent ?? 0}
                onAdjustFirstLineIndent={adjustFirstLineIndent}
              />
            ) : (
              <div className="toolbar toolbar-loading" aria-hidden="true" />
            )}
          </div>

          <main className="workspace" ref={workspaceRef}>
            {tabs.map((tab) => (
              <TabPane
                key={tab.id}
                tab={tab}
                active={tab.id === activeId}
                extensions={extensions}
                editorProps={editorProps}
                onReady={handleEditorReady}
                onDestroy={handleEditorDestroy}
                onUpdate={handleTabUpdate}
              />
            ))}

            {find && activeEditor ? (
              <FindReplace
                editor={activeEditor}
                mode={find.mode}
                onClose={closeFind}
              />
            ) : null}
          </main>

          {activeEditor ? (
            <StatusBar
              editor={activeEditor}
              path={activeTab?.path ?? null}
              dirty={activeTab?.dirty ?? false}
              saveState={activeTab?.saveState ?? 'idle'}
              lastSavedAt={activeTab?.lastSavedAt ?? null}
              previewMode={previewMode}
              cloud={activeCloudStatus}
              onOpenSync={() => setSyncOpen(true)}
            />
          ) : (
            <footer className="statusbar" />
          )}
        </div>
      </div>

      {dragActive ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <Upload size={26} />
            <strong>松开以打开或插入</strong>
            <span>.lwd 文档将在新标签页中打开，图片将插入到光标处</span>
          </div>
        </div>
      ) : null}

      <Toasts toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        busy={confirmBusy}
        onSave={() => void handleConfirmSave()}
        onDiscard={() => void handleConfirmDiscard()}
        onCancel={handleConfirmCancel}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <PageSetupDialog
        open={pageSetupOpen}
        layout={activeTab?.layout ?? DEFAULT_PAGE_LAYOUT}
        onApply={applyPageLayout}
        onSaveDefault={persistDefaultLayout}
        onClose={() => setPageSetupOpen(false)}
      />

      <SyncSettingsDialog
        open={syncOpen}
        settings={syncSettings}
        saving={syncSaving}
        onSave={(draft) => void handleSaveSyncSettings(draft)}
        onClose={() => setSyncOpen(false)}
      />

      <LinkDialog
        open={linkDialog.open}
        initialUrl={linkDialog.url}
        hasLink={linkDialog.hasLink}
        onApply={applyLink}
        onClose={() =>
          setLinkDialog((current) => ({ ...current, open: false }))
        }
      />
    </div>
  )
}
