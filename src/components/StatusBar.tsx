import type { Editor } from '@tiptap/core'
import {
  Cloud,
  CloudOff,
  HardDrive,
  Loader2,
  TriangleAlert,
  Type,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { formatClock, formatNumber, countText } from '../lib/text'
import type { CloudStatus, SaveState } from '../lib/types'

interface StatusBarProps {
  editor: Editor
  path: string | null
  dirty: boolean
  saveState: SaveState
  lastSavedAt: string | null
  previewMode: boolean
  cloud: CloudStatus
  onOpenSync: () => void
}

export function StatusBar({
  editor,
  path,
  dirty,
  saveState,
  lastSavedAt,
  previewMode,
  cloud,
  onOpenSync,
}: StatusBarProps) {
  const [counts, setCounts] = useState({ words: 0, characters: 0 })
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const update = () => {
      const text = editor.getText({ blockSeparator: '\n' })
      setCounts(countText(text))
    }
    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(update, 160)
    }
    update()
    editor.on('transaction', schedule)
    return () => {
      editor.off('transaction', schedule)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [editor])

  const saveText =
    saveState === 'saving'
      ? '正在保存…'
      : saveState === 'error'
        ? '自动保存失败'
        : dirty
          ? '等待自动保存'
          : lastSavedAt
            ? `已保存 ${formatClock(lastSavedAt)}`
            : '尚未修改'

  const cloudText =
    cloud.state === 'unconfigured'
      ? '云盘未配置'
      : cloud.state === 'syncing'
        ? '云盘同步中…'
        : cloud.state === 'synced'
          ? `云盘已同步 ${formatClock(cloud.at)}`
          : cloud.state === 'error'
            ? `云盘失败：${cloud.message ?? '未知错误'}`
            : '云盘已配置'
  const cloudTitle =
    cloud.state === 'error'
      ? cloud.message ?? '云盘同步失败'
      : '打开云盘同步设置'
  const CloudIcon =
    cloud.state === 'unconfigured'
      ? CloudOff
      : cloud.state === 'syncing'
        ? Loader2
        : cloud.state === 'error'
          ? TriangleAlert
          : Cloud

  return (
    <footer className="statusbar">
      <div className="status-left">
        <HardDrive size={12} />
        <span className="status-path" title={path ?? '尚未保存'}>
          {path ?? '本地草稿'}
        </span>
      </div>

      <div className="status-center">
        {previewMode ? (
          <>
            <Cloud size={12} />
            浏览器预览模式
          </>
        ) : (
          <>
            <Cloud size={12} />
            自动保存 · {saveText}
          </>
        )}
        <button
          type="button"
          className={`status-cloud status-cloud-${cloud.state}`}
          onClick={onOpenSync}
          title={cloudTitle}
        >
          <CloudIcon
            size={12}
            className={cloud.state === 'syncing' ? 'spin' : undefined}
          />
          <span>{cloudText}</span>
        </button>
      </div>

      <div className="status-right">
        <span title="字数：中文按字、西文按词统计">
          <Type size={12} /> {formatNumber(counts.words)} 字
        </span>
        <span>{formatNumber(counts.characters)} 字符</span>
        <span>UTF-8</span>
        <span>简体中文</span>
      </div>
    </footer>
  )
}
