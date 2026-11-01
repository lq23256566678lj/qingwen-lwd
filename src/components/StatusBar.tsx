import type { Editor } from '@tiptap/core'
import { Cloud, HardDrive, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { formatClock, formatNumber, countText } from '../lib/text'
import type { SaveState } from '../lib/types'

interface StatusBarProps {
  editor: Editor
  path: string | null
  dirty: boolean
  saveState: SaveState
  lastSavedAt: string | null
  previewMode: boolean
}

export function StatusBar({
  editor,
  path,
  dirty,
  saveState,
  lastSavedAt,
  previewMode,
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
