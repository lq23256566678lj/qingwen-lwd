import {
  ChevronDown,
  ChevronRight,
  FileText,
  PanelLeftClose,
  Plus,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { getChildren, getSubtreeIds } from '../lib/tabs'
import type { TabRecord } from '../lib/types'

interface TabSidebarProps {
  tabs: TabRecord[]
  activeId: string
  open: boolean
  onSelect: (id: string) => void
  onCreateRoot: () => void
  onCreateChild: (id: string) => void
  onClose: (id: string) => void
  onToggleExpand: (id: string) => void
  onRename: (id: string, title: string) => void
  onMoveTab: (dragId: string, targetId: string) => void
  onMoveToRoot: (dragId: string) => void
  onToggleOpen: () => void
}

interface TabTreeItemProps
  extends Omit<
    TabSidebarProps,
    'tabs' | 'open' | 'onCreateRoot' | 'onToggleOpen' | 'onRename' | 'onMoveTab' | 'onMoveToRoot'
  > {
  tabs: TabRecord[]
  tab: TabRecord
  depth: number
  renamingId: string | null
  renameValue: string
  cancelRenameRef: MutableRefObject<boolean>
  onStartRename: (tab: TabRecord) => void
  onRenameValue: (value: string) => void
  onFinishRename: (id: string, value: string) => void
  onCancelRename: () => void
  draggingId: string | null
  dropTargetId: string | null
}

function TabTreeItem({
  tabs,
  tab,
  depth,
  activeId,
  renamingId,
  renameValue,
  cancelRenameRef,
  onSelect,
  onCreateChild,
  onClose,
  onToggleExpand,
  onStartRename,
  onRenameValue,
  onFinishRename,
  onCancelRename,
  draggingId,
  dropTargetId,
}: TabTreeItemProps) {
  const children = getChildren(tabs, tab.id)
  const expanded = tab.expanded !== false
  const renaming = renamingId === tab.id
  const isDragging = draggingId === tab.id
  const isDropTarget = dropTargetId === tab.id
  const inputRef = useRef<HTMLInputElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!renaming) return
    const input = inputRef.current
    input?.focus()
    input?.select()
  }, [renaming])

  return (
    <li className="tab-tree-item">
      <div
        className={`tab-row${tab.id === activeId ? ' is-active' : ''}${
          isDragging ? ' is-dragging' : ''
        }${isDropTarget ? ' is-drop-target' : ''}`}
        style={{ paddingLeft: 6 + Math.min(depth, 8) * 14 }}
        data-tab-row-id={tab.id}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(tab.id)}
        onDoubleClick={() => onStartRename(tab)}
        role="treeitem"
        aria-selected={tab.id === activeId}
        aria-expanded={children.length > 0 ? expanded : undefined}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSelect(tab.id)
          if (event.key === 'F2') onStartRename(tab)
        }}
        title={tab.path ?? tab.title}
      >
        <button
          type="button"
          className={`tab-chevron${children.length === 0 ? ' is-placeholder' : ''}`}
          aria-label={expanded ? '折叠子标签页' : '展开子标签页'}
          disabled={children.length === 0}
          onClick={(event) => {
            event.stopPropagation()
            if (children.length > 0) onToggleExpand(tab.id)
          }}
        >
          {children.length > 0 ? (
            expanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : null}
        </button>

        <FileText size={14} className="tab-file-icon" aria-hidden="true" />

        {renaming ? (
          <input
            ref={inputRef}
            className="tab-rename-input"
            value={renameValue}
            spellCheck={false}
            onChange={(event) => onRenameValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => {
              if (cancelRenameRef.current) {
                cancelRenameRef.current = false
                onCancelRename()
                return
              }
              onFinishRename(tab.id, renameValue)
            }}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                event.preventDefault()
                onFinishRename(tab.id, renameValue)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelRenameRef.current = true
                event.currentTarget.blur()
              }
            }}
          />
        ) : (
          <span className="tab-title">{tab.title}</span>
        )}

        {tab.dirty ? <span className="tab-dirty-dot" title="未保存" /> : null}

        <span className={`tab-actions${hovered || tab.id === activeId ? ' is-visible' : ''}`}>
          <button
            type="button"
            className="tab-action"
            title="新建子标签页"
            aria-label="新建子标签页"
            onClick={(event) => {
              event.stopPropagation()
              onCreateChild(tab.id)
            }}
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="tab-action"
            title="关闭标签页"
            aria-label="关闭标签页"
            onClick={(event) => {
              event.stopPropagation()
              onClose(tab.id)
            }}
          >
            <X size={13} />
          </button>
        </span>
      </div>

      {children.length > 0 && expanded ? (
        <ul className="tab-tree-children" role="group">
          {children.map((child) => (
            <TabTreeItem
              key={child.id}
              tabs={tabs}
              tab={child}
              depth={depth + 1}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              cancelRenameRef={cancelRenameRef}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onClose={onClose}
              onToggleExpand={onToggleExpand}
              onStartRename={onStartRename}
              onRenameValue={onRenameValue}
              onFinishRename={onFinishRename}
              onCancelRename={onCancelRename}
              draggingId={draggingId}
              dropTargetId={dropTargetId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function TabSidebar({
  tabs,
  activeId,
  open,
  onSelect,
  onCreateRoot,
  onCreateChild,
  onClose,
  onToggleExpand,
  onRename,
  onMoveTab,
  onMoveToRoot,
  onToggleOpen,
}: TabSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [rootDropActive, setRootDropActive] = useState(false)
  const roots = getChildren(tabs, null)
  const draggedTab = draggingId
    ? tabs.find((tab) => tab.id === draggingId)
    : null
  const canDropToRoot = Boolean(draggedTab?.parentId)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    active: boolean
    targetId: string | null
    rootDrop: boolean
  } | null>(null)
  const suppressClickUntilRef = useRef(0)
  const cancelRenameRef = useRef(false)

  const isValidDrop = (sourceId: string, targetId: string): boolean => {
    if (!sourceId || !targetId || sourceId === targetId) return false
    const dragged = tabs.find((tab) => tab.id === sourceId)
    if (!dragged || dragged.parentId === targetId) return false
    return !getSubtreeIds(tabs, sourceId).includes(targetId)
  }

  const selectTab = (id: string) => {
    if (performance.now() < suppressClickUntilRef.current) return
    onSelect(id)
  }

  const startRename = (tab: TabRecord) => {
    if (performance.now() < suppressClickUntilRef.current) return
    cancelRenameRef.current = false
    setRenamingId(tab.id)
    setRenameValue(tab.title)
  }

  const finishPointerDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    setDraggingId(null)
    setDropTargetId(null)
    setRootDropActive(false)
    document.body.classList.remove('tab-dragging')
    if (!drag?.active) return
    suppressClickUntilRef.current = performance.now() + 350
    if (drag.rootDrop) onMoveToRoot(drag.id)
    else if (drag.targetId) onMoveTab(drag.id, drag.targetId)
  }

  const cancelPointerDrag = () => {
    dragRef.current = null
    setDraggingId(null)
    setDropTargetId(null)
    setRootDropActive(false)
    document.body.classList.remove('tab-dragging')
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, select')) return
    const row = target.closest<HTMLElement>('[data-tab-row-id]')
    const id = row?.dataset.tabRowId
    if (!row || !id) return
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      targetId: null,
      rootDrop: false,
    }
    try {
      row.setPointerCapture(event.pointerId)
    } catch {
      // 某些 WebView 不支持 pointer capture 时会静默退化；仍可通过容器事件完成。
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.active) {
      const distance = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      )
      if (distance < 6) return
      drag.active = true
      setDraggingId(drag.id)
      document.body.classList.add('tab-dragging')
    }
    event.preventDefault()
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const dragged = tabs.find((tab) => tab.id === drag.id)
    const rootZone = element?.closest<HTMLElement>('[data-tab-root-drop]')
    if (rootZone && dragged?.parentId) {
      drag.rootDrop = true
      drag.targetId = null
      setRootDropActive(true)
      setDropTargetId(null)
      return
    }

    drag.rootDrop = false
    setRootDropActive(false)
    const row = element?.closest<HTMLElement>('[data-tab-row-id]')
    const targetId = row?.dataset.tabRowId ?? null
    const nextTarget =
      targetId && isValidDrop(drag.id, targetId) ? targetId : null
    drag.targetId = nextTarget
    setDropTargetId(nextTarget)
  }

  useEffect(() => {
    return () => {
      document.body.classList.remove('tab-dragging')
    }
  }, [])

  const finishRename = (id: string, value: string) => {
    if (renamingId !== id) return
    const next = value.trim()
    if (next) onRename(id, next)
    setRenamingId(null)
  }

  return (
    <aside className={`tab-sidebar${open ? '' : ' is-closed'}`} aria-label="标签页侧栏">
      <div className="tab-sidebar-header">
        <div className="tab-sidebar-heading">
          <span className="tab-sidebar-title">文档树</span>
          <span className="tab-sidebar-count">{tabs.length}</span>
        </div>
        <div className="tab-sidebar-header-actions">
          <button
            type="button"
            className="icon-btn"
            title="新建标签页"
            aria-label="新建标签页"
            onClick={onCreateRoot}
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="收起侧栏"
            aria-label="收起侧栏"
            onClick={onToggleOpen}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      <div
        className="tab-sidebar-scroll"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={cancelPointerDrag}
      >
        <ul className="tab-tree" role="tree" aria-label="标签页树">
          {roots.map((tab) => (
            <TabTreeItem
              key={tab.id}
              tabs={tabs}
              tab={tab}
              depth={0}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              cancelRenameRef={cancelRenameRef}
              onSelect={selectTab}
              onCreateChild={onCreateChild}
              onClose={onClose}
              onToggleExpand={onToggleExpand}
              onStartRename={startRename}
              onRenameValue={setRenameValue}
              onFinishRename={finishRename}
              onCancelRename={() => setRenamingId(null)}
              draggingId={draggingId}
              dropTargetId={dropTargetId}
            />
          ))}
        </ul>
        {canDropToRoot ? (
          <div
            className={`tab-root-drop${rootDropActive ? ' is-active' : ''}`}
            data-tab-root-drop
          >
            拖到这里，把「{draggedTab?.title}」变成根标签页
          </div>
        ) : null}
      </div>

      <div className="tab-sidebar-footer">
        <span>双击重命名 · + 新建子标签 · 拖动可挂到其它标签下</span>
        <button
          type="button"
          className="tab-sidebar-new-root"
          onClick={onCreateRoot}
          title="新建根标签页"
        >
          <Plus size={12} /> 新标签
        </button>
      </div>
    </aside>
  )
}
