import { ChevronDown, Download, FolderOpen, Info, Keyboard, Save, Search } from 'lucide-react'

import {
  formatClock,
  formatDateTime,
} from '../lib/text'
import type { ExportFormat, SaveState } from '../lib/types'
import { Popover } from './ui'

interface TopBarProps {
  title: string
  path: string | null
  dirty: boolean
  saveState: SaveState
  lastSavedAt: string | null
  previewMode: boolean
  onOpen: () => void
  onSave: () => void
  onExport: (format: ExportFormat) => void
  onToggleFind: () => void
  onShowShortcuts: () => void
  onShowAbout: () => void
}

export function TopBar({
  title,
  path,
  dirty,
  saveState,
  lastSavedAt,
  previewMode,
  onOpen,
  onSave,
  onExport,
  onToggleFind,
  onShowShortcuts,
  onShowAbout,
}: TopBarProps) {
  const statusText =
    saveState === 'saving'
      ? '正在保存…'
      : saveState === 'error'
        ? '保存失败'
        : dirty
          ? '有未保存修改 · 自动保存中'
          : lastSavedAt
            ? `已保存 ${formatClock(lastSavedAt)}`
            : '就绪'

  const statusClass =
    saveState === 'error'
      ? 'is-error'
      : saveState === 'saving'
        ? 'is-saving'
        : dirty
          ? 'is-dirty'
          : 'is-saved'

  return (
    <header className="topbar">
      <div className="brand" title="轻文 · 轻量级富文本编辑器">
        <span className="brand-mark" aria-hidden="true">
          文
        </span>
        <span className="brand-name">轻文</span>
        <span className="brand-tag">LWD</span>
      </div>

      <div className="topbar-separator" />

      <div className="doc-identity">
        <div className="doc-title-row">
          <span className="doc-title" title={title}>
            {title || '无标题'}
          </span>
          <span className={`save-dot ${statusClass}`} aria-hidden="true" />
          <span className="doc-status">{statusText}</span>
          {previewMode ? (
            <span className="preview-badge" title="当前在浏览器中预览，桌面文件功能不可用">
              浏览器预览
            </span>
          ) : null}
        </div>
        <div
          className="doc-path"
          title={path ?? '尚未保存到文件'}
        >
          {path ?? '尚未保存到文件'}
          {lastSavedAt ? ` · ${formatDateTime(lastSavedAt)}` : ''}
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn topbar-icon"
          title="查找和替换"
          aria-label="查找和替换"
          onClick={onToggleFind}
        >
          <Search size={17} />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onOpen}
          title="打开 .lwd 文档"
        >
          <FolderOpen size={16} />
          <span className="btn-label">打开</span>
        </button>

        <Popover
          align="right"
          trigger={() => (
            <button type="button" className="btn btn-ghost">
              <Download size={16} />
              <span className="btn-label">导出</span>
              <ChevronDown size={13} />
            </button>
          )}
        >
          {(close) => (
            <div className="menu menu-wide">
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onExport('text')
                  close()
                }}
              >
                纯文本（.txt）
                <span className="menu-note">仅保留文字</span>
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onExport('html')
                  close()
                }}
              >
                HTML（.html）
                <span className="menu-note">保留样式，可打印</span>
              </button>
            </div>
          )}
        </Popover>

        <button type="button" className="btn btn-primary" onClick={onSave}>
          <Save size={16} />
          <span>保存</span>
        </button>

        <Popover
          align="right"
          trigger={() => (
            <button
              type="button"
              className="icon-btn topbar-icon"
              title="更多"
              aria-label="更多"
            >
              <Info size={17} />
            </button>
          )}
        >
          {(close) => (
            <div className="menu menu-wide">
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onShowShortcuts()
                  close()
                }}
              >
                <Keyboard size={14} />
                键盘快捷键
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onShowAbout()
                  close()
                }}
              >
                <Info size={14} />
                关于轻文
              </button>
            </div>
          )}
        </Popover>
      </div>
    </header>
  )
}
