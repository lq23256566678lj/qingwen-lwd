import type { Editor } from '@tiptap/core'
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Replace,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  getSearchState,
  replaceAllSearchMatches,
  replaceSearchMatch,
  scrollToSearchMatch,
  updateSearch,
} from '../editor/SearchHighlight'

interface FindReplaceProps {
  editor: Editor
  mode: 'find' | 'replace'
  onClose: () => void
}

export function FindReplace({ editor, mode, onClose }: FindReplaceProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [showReplace, setShowReplace] = useState(mode === 'replace')
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(0)
  const [searchTick, setSearchTick] = useState(0)
  const [status, setStatus] = useState('')

  const queryRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const statusTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setShowReplace(mode === 'replace')
  }, [mode])

  useEffect(() => {
    queryRef.current?.focus()
    queryRef.current?.select()
  }, [])

  useEffect(() => {
    const sync = () => {
      const state = getSearchState(editor)
      setTotal(state?.matches.length ?? 0)
      setActive(state?.activeIndex ?? 0)
    }
    sync()
    editor.on('transaction', sync)
    return () => {
      editor.off('transaction', sync)
    }
  }, [editor])

  useEffect(() => {
    if (composingRef.current) return
    const timer = window.setTimeout(() => {
      updateSearch(editor, {
        query,
        caseSensitive,
        activeIndex: 0,
      })
      const state = getSearchState(editor)
      if (state && state.matches.length > 0) {
        window.requestAnimationFrame(() =>
          scrollToSearchMatch(editor, state.activeIndex),
        )
      }
    }, 90)
    return () => window.clearTimeout(timer)
  }, [editor, query, caseSensitive, searchTick])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    return () => {
      updateSearch(editor, { clear: true })
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    }
  }, [editor])

  const showStatus = (text: string) => {
    setStatus(text)
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 2400)
  }

  const goTo = (direction: 1 | -1) => {
    const state = getSearchState(editor)
    if (!state || state.matches.length === 0) return
    const count = state.matches.length
    const next = (state.activeIndex + direction + count) % count
    updateSearch(editor, { activeIndex: next })
    scrollToSearchMatch(editor, next)
  }

  const replaceCurrent = () => {
    const state = getSearchState(editor)
    if (!state || state.matches.length === 0) return
    const match = state.matches[state.activeIndex]
    if (!match) return
    replaceSearchMatch(editor, match, replacement)
    const nextState = getSearchState(editor)
    if (nextState && nextState.matches.length > 0) {
      scrollToSearchMatch(editor, nextState.activeIndex)
    }
    editor.commands.focus()
    showStatus('已替换 1 处')
  }

  const replaceAll = () => {
    const state = getSearchState(editor)
    if (!state || state.matches.length === 0) return
    const count = replaceAllSearchMatches(editor, state.matches, replacement)
    editor.commands.focus()
    showStatus(`已替换 ${count} 处`)
  }

  const handleCompositionEnd = () => {
    composingRef.current = false
    setSearchTick((value) => value + 1)
  }

  const displayIndex = total > 0 ? active + 1 : 0

  return (
    <div
      className="find-panel"
      role="dialog"
      aria-label="查找和替换"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div className="find-header">
        <span className="find-title">查找和替换</span>
        <button
          type="button"
          className="icon-btn"
          title="关闭"
          aria-label="关闭查找替换"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>

      <div className="find-row">
        <div className="find-input-wrap">
          <input
            ref={queryRef}
            className="find-input"
            type="text"
            value={query}
            placeholder="查找内容"
            aria-label="查找内容"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Enter') {
                event.preventDefault()
                goTo(event.shiftKey ? -1 : 1)
              }
            }}
          />
          <span className="find-count">
            {query ? `${displayIndex}/${total}` : '—'}
          </span>
        </div>
        <button
          type="button"
          className={`icon-btn${caseSensitive ? ' is-active' : ''}`}
          title="区分大小写"
          aria-label="区分大小写"
          aria-pressed={caseSensitive}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          <CaseSensitive size={17} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="上一个"
          aria-label="上一个匹配项"
          disabled={total === 0}
          onClick={() => goTo(-1)}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="下一个"
          aria-label="下一个匹配项"
          disabled={total === 0}
          onClick={() => goTo(1)}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {showReplace ? (
        <>
          <div className="find-row">
            <div className="find-input-wrap">
              <Replace size={14} className="find-row-icon" aria-hidden="true" />
              <input
                ref={replaceRef}
                className="find-input has-icon"
                type="text"
                value={replacement}
                placeholder="替换为"
                aria-label="替换为"
                spellCheck={false}
                onChange={(event) => setReplacement(event.target.value)}
                onCompositionStart={() => {
                  composingRef.current = true
                }}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (event.shiftKey) goTo(-1)
                    else replaceCurrent()
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={total === 0}
              onClick={replaceCurrent}
            >
              替换
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={total === 0}
              onClick={replaceAll}
            >
              全部
            </button>
          </div>
          {total === 0 && query ? (
            <div className="find-empty">没有找到匹配内容</div>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className="find-toggle"
          onClick={() => {
            setShowReplace(true)
            window.requestAnimationFrame(() => replaceRef.current?.focus())
          }}
        >
          展开替换
        </button>
      )}

      {status ? <div className="find-status">{status}</div> : null}

      <div className="find-hint">
        回车查找下一个 · Shift+回车查找上一个 · Esc 关闭
      </div>
    </div>
  )
}
