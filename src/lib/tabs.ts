import type { JSONContent } from '@tiptap/core'

import {
  DEFAULT_PAGE_LAYOUT,
  normalizeLayout,
} from './layout'
import {
  EMPTY_DOCUMENT,
  type PageLayout,
  type SaveState,
  type TabRecord,
  type WorkspaceSession,
} from './types'

let tabSequence = 0

export function newTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  tabSequence += 1
  return `tab-${Date.now()}-${tabSequence}`
}

export function createBlankTab(
  parentId: string | null = null,
  layout: PageLayout = DEFAULT_PAGE_LAYOUT,
): TabRecord {
  return {
    id: newTabId(),
    parentId,
    title: '无标题',
    path: null,
    createdAt: null,
    document: EMPTY_DOCUMENT,
    dirty: false,
    saveState: 'idle',
    lastSavedAt: null,
    expanded: true,
    layout: normalizeLayout(layout),
  }
}

export function createTabFromDocument(
  document: JSONContent,
  options: {
    parentId?: string | null
    title: string
    path: string | null
    createdAt: string | null
    dirty?: boolean
    savedAt?: string | null
    layout?: PageLayout
  },
): TabRecord {
  const dirty = options.dirty ?? false
  return {
    id: newTabId(),
    parentId: options.parentId ?? null,
    title: options.title.trim() || '无标题',
    path: options.path,
    createdAt: options.createdAt,
    document,
    dirty,
    saveState: dirty ? 'dirty' : options.path ? 'saved' : 'idle',
    lastSavedAt: options.savedAt ?? null,
    expanded: true,
    layout: normalizeLayout(options.layout ?? DEFAULT_PAGE_LAYOUT),
  }
}

export function getTab(tabs: TabRecord[], id: string): TabRecord | undefined {
  return tabs.find((tab) => tab.id === id)
}

export function getSubtreeIds(tabs: TabRecord[], rootId: string): string[] {
  const result: string[] = []
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || result.includes(id)) continue
    result.push(id)
    for (const tab of tabs) {
      if (tab.parentId === id) queue.push(tab.id)
    }
  }
  return result
}

export function getChildren(
  tabs: TabRecord[],
  parentId: string | null,
): TabRecord[] {
  return tabs.filter((tab) => tab.parentId === parentId)
}

export function hasChildren(tabs: TabRecord[], id: string): boolean {
  return tabs.some((tab) => tab.parentId === id)
}

/**
 * 关闭一组标签页后选择新的活动标签：优先保留原活动标签；否则依次尝试
 * 父标签、右侧兄弟、左侧兄弟、第一个剩余标签。
 */
export function findNextActiveId(
  tabs: TabRecord[],
  removedIds: Set<string>,
  activeId: string,
): string | null {
  const remaining = tabs.filter((tab) => !removedIds.has(tab.id))
  if (remaining.length === 0) return null
  if (!removedIds.has(activeId)) return activeId

  const activeIndex = tabs.findIndex((tab) => tab.id === activeId)
  const active = tabs[activeIndex]
  if (active?.parentId && !removedIds.has(active.parentId)) {
    return active.parentId
  }

  for (let index = activeIndex + 1; index < tabs.length; index += 1) {
    if (!removedIds.has(tabs[index].id)) return tabs[index].id
  }
  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    if (!removedIds.has(tabs[index].id)) return tabs[index].id
  }
  return remaining[0]?.id ?? null
}

function isDocument(value: unknown): value is JSONContent {
  if (!value || typeof value !== 'object') return false
  const document = value as JSONContent
  return document.type === 'doc'
}

function isSaveState(value: unknown): value is SaveState {
  return (
    value === 'idle' ||
    value === 'dirty' ||
    value === 'saving' ||
    value === 'saved' ||
    value === 'error'
  )
}

/**
 * 会话文件可能来自旧版本或损坏；这里做防御性归一化，避免一个坏字段
 * 让整个编辑器白屏。无法识别的标签页会被丢弃。
 */
export function sanitizeSessionTabs(
  session: unknown,
): { tabs: TabRecord[]; activeId: string } | null {
  if (!session || typeof session !== 'object') return null
  const raw = session as Partial<WorkspaceSession>
  if (raw.format !== 'lwd-session' || raw.version !== 1) return null
  if (!Array.isArray(raw.tabs)) return null

  const tabs: TabRecord[] = []
  const ids = new Set<string>()

  for (const entry of raw.tabs) {
    if (!entry || typeof entry !== 'object') continue
    const candidate = entry as Partial<TabRecord>
    if (typeof candidate.id !== 'string' || !candidate.id) continue
    if (ids.has(candidate.id)) continue
    if (typeof candidate.title !== 'string') continue
    if (!isDocument(candidate.document)) continue

    const dirty = Boolean(candidate.dirty)
    const path = typeof candidate.path === 'string' ? candidate.path : null
    let saveState: SaveState = isSaveState(candidate.saveState)
      ? candidate.saveState
      : dirty
        ? 'dirty'
        : path
          ? 'saved'
          : 'idle'
    if (saveState === 'saving' || saveState === 'error') {
      saveState = dirty ? 'dirty' : path ? 'saved' : 'idle'
    }

    tabs.push({
      id: candidate.id,
      parentId:
        typeof candidate.parentId === 'string' && candidate.parentId
          ? candidate.parentId
          : null,
      title: candidate.title.trim() || '无标题',
      path,
      createdAt:
        typeof candidate.createdAt === 'string' ? candidate.createdAt : null,
      document: candidate.document,
      dirty,
      saveState,
      lastSavedAt:
        typeof candidate.lastSavedAt === 'string'
          ? candidate.lastSavedAt
          : null,
      expanded: candidate.expanded !== false,
      layout: normalizeLayout(candidate.layout),
    })
    ids.add(candidate.id)
  }

  if (tabs.length === 0) return null

  // 父引用可能指向被丢弃/不存在的标签；兜底为根标签。
  for (const tab of tabs) {
    if (tab.parentId && !ids.has(tab.parentId)) tab.parentId = null
  }

  // 防止损坏的 parentId 形成环。
  for (const tab of tabs) {
    let cursor = tab.parentId
    let depth = 0
    while (cursor && depth <= tabs.length) {
      if (cursor === tab.id) {
        tab.parentId = null
        break
      }
      cursor = tabs.find((item) => item.id === cursor)?.parentId ?? null
      depth += 1
    }
  }

  if (!tabs.some((tab) => tab.parentId === null)) {
    tabs[0].parentId = null
  }

  const activeId =
    typeof raw.activeId === 'string' && tabs.some((tab) => tab.id === raw.activeId)
      ? raw.activeId
      : tabs[0].id

  return { tabs, activeId }
}
