import type { Editor, EditorOptions, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AboutDialog } from './components/AboutDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { FindReplace } from './components/FindReplace'
import { LinkDialog } from './components/LinkDialog'
import { RecoveryBanner } from './components/RecoveryBanner'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { StatusBar } from './components/StatusBar'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
import { createEditorExtensions } from './editor/extensions'
import {
  exportDocument,
  importImage,
  quitApp,
  readDocument,
  readDraft,
  removeDraft,
  writeDocument,
  writeDraft,
} from './lib/api'
import {
  imageFileToDataUrl,
  optimizeImageDataUrl,
} from './lib/image'
import { IS_MAC, IS_TAURI } from './lib/platform'
import {
  buildMeta,
  buildStandaloneHtml,
  ensureExtension,
  isImagePath,
  isLwdPath,
  titleFromPath,
} from './lib/text'
import {
  EMPTY_DOCUMENT,
  type DocMeta,
  type DraftPayload,
  type ExportFormat,
  type SaveState,
  type ToastKind,
  type ToastMessage,
} from './lib/types'

interface ApplyDocumentInput {
  document: JSONContent
  path: string | null
  title: string
  createdAt: string | null
  dirty: boolean
  savedAt: string | null
}

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

function hasVisibleContent(document: JSONContent): boolean {
  const content = document.content
  if (!content || content.length === 0) return false
  return content.some((node) => {
    if (node.type !== 'paragraph') return true
    return (node.content?.length ?? 0) > 0
  })
}

export default function App() {
  const [title, setTitle] = useState('无标题')
  const [docPath, setDocPath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<DraftPayload | null>(null)
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
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [dragActive, setDragActive] = useState(false)

  const editorRef = useRef<Editor | null>(null)
  const docPathRef = useRef<string | null>(null)
  const titleRef = useRef('无标题')
  const createdAtRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const revisionRef = useRef(0)
  const suppressRef = useRef(false)
  const draftTimerRef = useRef<number | null>(null)
  const fileTimerRef = useRef<number | null>(null)
  const draftWriteRef = useRef<Promise<void> | null>(null)
  const savingRef = useRef<Promise<boolean> | null>(null)
  const lastDraftErrorRef = useRef(0)
  const lastFileErrorRef = useRef(0)
  const lastActionRef = useRef<Record<string, number>>({})
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null)
  const closingRef = useRef(false)
  const confirmOpenRef = useRef(false)
  const toastSeqRef = useRef(0)
  const pasteImagesRef = useRef<(files: File[]) => void>(() => {})

  const pushToast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = (toastSeqRef.current += 1)
    setToasts((current) => [...current.slice(-3), { id, kind, text }])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const metaNow = useCallback((): DocMeta => {
    const text = editorRef.current?.getText({ blockSeparator: '\n' }) ?? ''
    return buildMeta(titleRef.current, text)
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

  const editor = useEditor({
    extensions,
    content: EMPTY_DOCUMENT,
    autofocus: 'start',
    editorProps,
  })

  useEffect(() => {
    editorRef.current = editor
    return () => {
      editorRef.current = null
    }
  }, [editor])

  const applyDocumentState = useCallback(
    (input: ApplyDocumentInput): boolean => {
      const current = editorRef.current
      if (!current) return false

      suppressRef.current = true
      try {
        current.commands.setContent(input.document, {
          emitUpdate: false,
          errorOnInvalidContent: true,
        })
      } catch (error) {
        pushToast(`无法载入文档：${errorMessage(error)}`, 'error')
        return false
      } finally {
        suppressRef.current = false
      }

      const nextTitle =
        input.title.trim() ||
        (input.path ? titleFromPath(input.path) : '无标题')

      docPathRef.current = input.path
      setDocPath(input.path)
      titleRef.current = nextTitle
      setTitle(nextTitle)
      createdAtRef.current = input.createdAt
      revisionRef.current += 1
      dirtyRef.current = input.dirty
      setDirty(input.dirty)
      setSaveState(
        input.dirty ? 'dirty' : input.savedAt ? 'saved' : 'idle',
      )
      setLastSavedAt(input.savedAt)
      setFind(null)

      if (draftTimerRef.current) {
        window.clearTimeout(draftTimerRef.current)
        draftTimerRef.current = null
      }
      if (fileTimerRef.current) {
        window.clearTimeout(fileTimerRef.current)
        fileTimerRef.current = null
      }

      window.requestAnimationFrame(() => {
        window.document.querySelector<HTMLElement>('.workspace')?.scrollTo({
          top: 0,
          behavior: 'auto',
        })
        if (editorRef.current === current) current.commands.focus('start')
      })
      return true
    },
    [pushToast],
  )

  const saveDraftNow = useCallback(async () => {
    if (!IS_TAURI) return
    const current = editorRef.current
    if (!current) return
    // 同一时间只写一份草稿；下一次输入会重新安排。
    if (draftWriteRef.current) return

    const task = (async () => {
      try {
        await writeDraft(
          current.getJSON(),
          metaNow(),
          docPathRef.current,
          titleRef.current,
          createdAtRef.current,
        )
      } catch (error) {
        const now = Date.now()
        if (now - lastDraftErrorRef.current > 30_000) {
          lastDraftErrorRef.current = now
          pushToast(`草稿备份失败：${errorMessage(error)}`, 'error')
        }
      }
    })()
    draftWriteRef.current = task
    try {
      await task
    } finally {
      if (draftWriteRef.current === task) draftWriteRef.current = null
    }
  }, [metaNow, pushToast])

  const performSave = useCallback(
    async (options: SaveOptions = {}): Promise<boolean> => {
      if (!IS_TAURI) {
        if (!options.quiet) {
          pushToast('文件功能仅在桌面应用中可用', 'info')
        }
        return false
      }
      const current = editorRef.current
      if (!current) return false

      if (savingRef.current) await savingRef.current

      const task = (async (): Promise<boolean> => {
        let target = docPathRef.current
        const isNewPath = !target

        if (options.saveAs || !target) {
          const chosen = await saveDialog({
            title: '保存为轻文文档',
            defaultPath: target ?? `${safeFileName(titleRef.current)}.lwd`,
            filters: [{ name: '轻文文档', extensions: ['lwd'] }],
          })
          if (!chosen) return false
          target = ensureExtension(chosen, 'lwd')
        }
        if (!target) return false

        const revisionAtStart = revisionRef.current
        setSaveState('saving')

        try {
          const result = await writeDocument(
            target,
            current.getJSON(),
            metaNow(),
            createdAtRef.current,
          )

          docPathRef.current = result.path
          createdAtRef.current = result.createdAt
          setDocPath(result.path)
          setLastSavedAt(result.updatedAt)

          if (isNewPath || options.saveAs) {
            const nextTitle = titleFromPath(result.path)
            titleRef.current = nextTitle
            setTitle(nextTitle)
          }

          if (revisionRef.current === revisionAtStart) {
            if (draftTimerRef.current) {
              window.clearTimeout(draftTimerRef.current)
              draftTimerRef.current = null
            }
            if (fileTimerRef.current) {
              window.clearTimeout(fileTimerRef.current)
              fileTimerRef.current = null
            }
            if (draftWriteRef.current) {
              await draftWriteRef.current.catch(() => undefined)
            }
            await removeDraft().catch(() => undefined)
            setRecovery(null)
            dirtyRef.current = false
            setDirty(false)
            setSaveState('saved')
          } else {
            // 保存期间又有输入：保留新内容对应的自动保存定时器与草稿。
            setSaveState('dirty')
          }
          return true
        } catch (error) {
          setSaveState('error')
          const now = Date.now()
          if (
            !options.quiet ||
            now - lastFileErrorRef.current > 30_000
          ) {
            lastFileErrorRef.current = now
            pushToast(`保存失败：${errorMessage(error)}`, 'error')
          }
          return false
        }
      })()

      savingRef.current = task
      try {
        return await task
      } finally {
        if (savingRef.current === task) savingRef.current = null
      }
    },
    [metaNow, pushToast],
  )

  const scheduleDraft = useCallback(() => {
    if (!IS_TAURI) return
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current)
    draftTimerRef.current = window.setTimeout(() => {
      draftTimerRef.current = null
      void saveDraftNow()
    }, 900)
  }, [saveDraftNow])

  const scheduleFile = useCallback(() => {
    if (!IS_TAURI) return
    if (!docPathRef.current) return
    if (fileTimerRef.current) window.clearTimeout(fileTimerRef.current)
    fileTimerRef.current = window.setTimeout(() => {
      fileTimerRef.current = null
      void performSave({ quiet: true })
    }, 2400)
  }, [performSave])

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
            .setImage({
              src: dataUrl,
              alt: file.name || '粘贴的图片',
            })
            .run()
        } catch (error) {
          pushToast(`插入图片失败：${errorMessage(error)}`, 'error')
        }
      }
    },
    [pushToast],
  )

  useEffect(() => {
    pasteImagesRef.current = insertClipboardImages
  }, [insertClipboardImages])

  const destroyWindow = useCallback(async () => {
    if (!IS_TAURI) return
    if (closingRef.current) return
    closingRef.current = true
    try {
      await getCurrentWindow().destroy()
    } catch (error) {
      closingRef.current = false
      pushToast(`关闭窗口失败：${errorMessage(error)}`, 'error')
    }
  }, [pushToast])

  const guardUnsaved = useCallback((action: () => void | Promise<void>) => {
    if (!dirtyRef.current) {
      void action()
      return
    }
    pendingActionRef.current = action
    setConfirmOpen(true)
  }, [])

  const finishPending = useCallback(async () => {
    setConfirmOpen(false)
    setConfirmBusy(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) await action()
  }, [])

  const requestClose = useCallback(() => {
    if (confirmOpenRef.current) return
    guardUnsaved(async () => {
      await destroyWindow()
    })
  }, [destroyWindow, guardUnsaved])

  const requestQuit = useCallback(() => {
    if (confirmOpenRef.current) return
    guardUnsaved(async () => {
      if (!IS_TAURI) {
        window.close()
        return
      }
      try {
        await quitApp()
      } catch (error) {
        pushToast(`退出失败：${errorMessage(error)}`, 'error')
      }
    })
  }, [guardUnsaved, pushToast])

  const openPath = useCallback(
    async (path: string) => {
      try {
        const loaded = await readDocument(path)
        const applied = applyDocumentState({
          document: loaded.document,
          path: loaded.path,
          title: loaded.meta.title,
          createdAt: loaded.createdAt,
          dirty: false,
          savedAt: loaded.updatedAt,
        })
        if (applied) {
          setRecovery(null)
          if (IS_TAURI) await removeDraft().catch(() => undefined)
        }
      } catch (error) {
        pushToast(`打开失败：${errorMessage(error)}`, 'error')
      }
    },
    [applyDocumentState, pushToast],
  )

  const performNew = useCallback(() => {
    const applied = applyDocumentState({
      document: EMPTY_DOCUMENT,
      path: null,
      title: '无标题',
      createdAt: null,
      dirty: false,
      savedAt: null,
    })
    if (!applied) return
    setRecovery(null)
    if (IS_TAURI) void removeDraft().catch(() => undefined)
  }, [applyDocumentState])

  const requestNew = useCallback(() => {
    guardUnsaved(performNew)
  }, [guardUnsaved, performNew])

  const requestOpen = useCallback(() => {
    if (!IS_TAURI) {
      pushToast('文件功能仅在桌面应用中可用', 'info')
      return
    }
    guardUnsaved(async () => {
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
    })
  }, [guardUnsaved, openPath, pushToast])

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
      if (!current) return
      const extension = format === 'text' ? 'txt' : 'html'
      try {
        const chosen = await saveDialog({
          title: format === 'text' ? '导出为纯文本' : '导出为 HTML',
          defaultPath: `${safeFileName(titleRef.current)}.${extension}`,
          filters:
            format === 'text'
              ? [{ name: '纯文本', extensions: ['txt'] }]
              : [{ name: 'HTML', extensions: ['html', 'htm'] }],
        })
        if (!chosen) return

        const content =
          format === 'text'
            ? current.getText({ blockSeparator: '\n' })
            : buildStandaloneHtml(titleRef.current, current.getHTML())
        const target = ensureExportExtension(chosen, extension)
        const written = await exportDocument(target, content, format)
        pushToast(`已导出到 ${written}`, 'success')
      } catch (error) {
        pushToast(`导出失败：${errorMessage(error)}`, 'error')
      }
    },
    [pushToast],
  )

  const handleConfirmSave = useCallback(async () => {
    setConfirmBusy(true)
    const ok = await performSave()
    setConfirmBusy(false)
    if (!ok) return
    if (dirtyRef.current) {
      pushToast('保存期间文档发生了变化，请再次保存', 'error')
      return
    }
    await finishPending()
  }, [finishPending, performSave, pushToast])

  const handleConfirmDiscard = useCallback(async () => {
    setConfirmBusy(true)
    if (IS_TAURI) await removeDraft().catch(() => undefined)
    // 不在这里直接把 dirty 置为 false：若随后“打开”对话框被取消，
    // 当前文档仍然存在，必须继续被视为未保存。
    await finishPending()
  }, [finishPending])

  const handleConfirmCancel = useCallback(() => {
    pendingActionRef.current = null
    setConfirmOpen(false)
    setConfirmBusy(false)
    closingRef.current = false
  }, [])

  const restoreRecovery = useCallback(() => {
    if (!recovery) return
    const applied = applyDocumentState({
      document: recovery.document,
      path: recovery.filePath,
      title: recovery.title,
      createdAt: recovery.createdAt,
      dirty: true,
      savedAt: null,
    })
    if (applied) {
      setRecovery(null)
      pushToast('草稿已恢复，请记得保存', 'success')
    }
  }, [applyDocumentState, pushToast, recovery])

  const discardRecovery = useCallback(() => {
    setRecovery(null)
    if (IS_TAURI) void removeDraft().catch(() => undefined)
  }, [])

  const dismissRecovery = useCallback(() => {
    setRecovery(null)
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

  const runActionRef = useRef<(action: string) => void>(() => {})
  runActionRef.current = (action: string) => {
    const now = performance.now()
    const previous = lastActionRef.current[action] ?? 0
    if (now - previous < 250) return
    lastActionRef.current[action] = now

    const current = editorRef.current
    switch (action) {
      case 'new':
        requestNew()
        break
      case 'open':
        requestOpen()
        break
      case 'save':
        void performSave()
        break
      case 'save-as':
        void performSave({ saveAs: true })
        break
      case 'export-text':
        void requestExport('text')
        break
      case 'export-html':
        void requestExport('html')
        break
      case 'close':
        requestClose()
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

  useEffect(() => {
    const handleUpdate = () => {
      if (suppressRef.current) return
      revisionRef.current += 1
      if (!dirtyRef.current) {
        dirtyRef.current = true
        setDirty(true)
      }
      setSaveState((state) => (state === 'saving' ? state : 'dirty'))
      scheduleDraft()
      if (docPathRef.current) scheduleFile()
    }
    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, scheduleDraft, scheduleFile])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!dirtyRef.current || !IS_TAURI) return
      void saveDraftNow()
      if (docPathRef.current) void performSave({ quiet: true })
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [performSave, saveDraftNow])

  useEffect(() => {
    if (!IS_TAURI) return
    let cancelled = false
    readDraft()
      .then((draft) => {
        if (cancelled || !draft) return
        if (!hasVisibleContent(draft.document)) {
          void removeDraft().catch(() => undefined)
          return
        }
        setRecovery(draft)
      })
      .catch((error) => {
        pushToast(`读取自动保存草稿失败：${errorMessage(error)}`, 'error')
      })
    return () => {
      cancelled = true
    }
  }, [pushToast])

  useEffect(() => {
    if (!IS_TAURI) return
    const windowTitle = `${title}${dirty ? ' •' : ''} — 轻文 LWD`
    void getCurrentWindow().setTitle(windowTitle).catch(() => undefined)
  }, [title, dirty])

  useEffect(() => {
    confirmOpenRef.current = confirmOpen
  }, [confirmOpen])

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
            guardUnsaved(() => {
              void openPath(lwdPath)
            })
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
  }, [guardUnsaved, insertImagePath, openPath, pushToast])

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
    if (!IS_TAURI) return
    let unlisten: UnlistenFn | undefined
    let disposed = false
    getCurrentWindow()
      .onCloseRequested((event) => {
        event.preventDefault()
        if (closingRef.current || confirmOpenRef.current) return
        requestClose()
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
  }, [requestClose])

  const previewMode = !IS_TAURI

  if (!editor) {
    return (
      <div className="boot-screen">
        <span className="brand-mark">文</span>
        <p>正在启动轻文…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar
        title={title}
        path={docPath}
        dirty={dirty}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        previewMode={previewMode}
        onOpen={requestOpen}
        onSave={() => void performSave()}
        onExport={(format) => void requestExport(format)}
        onToggleFind={find ? closeFind : () => openFind('find')}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onShowAbout={() => setAboutOpen(true)}
      />

      <Toolbar
        editor={editor}
        onOpenImage={() => void requestInsertImage()}
        onOpenLink={openLinkDialog}
        onOpenFind={openFind}
      />

      <main className="workspace">
        <div className="page-shell">
          {recovery ? (
            <RecoveryBanner
              draft={recovery}
              onRestore={restoreRecovery}
              onDiscard={discardRecovery}
              onDismiss={dismissRecovery}
            />
          ) : null}
          <div className="paper">
            <EditorContent editor={editor} />
          </div>
        </div>

        {find ? (
          <FindReplace
            editor={editor}
            mode={find.mode}
            onClose={closeFind}
          />
        ) : null}
      </main>

      <StatusBar
        editor={editor}
        path={docPath}
        dirty={dirty}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        previewMode={previewMode}
      />

      {dragActive ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <Upload size={26} />
            <strong>松开以打开或插入</strong>
            <span>.lwd 文档将被打开，图片将插入到光标处</span>
          </div>
        </div>
      ) : null}

      <Toasts toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDialog
        open={confirmOpen}
        title="保存更改？"
        message={`当前文档「${title}」有未保存的修改，保存后再继续吗？`}
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
