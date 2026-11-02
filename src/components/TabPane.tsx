import type { Editor, EditorOptions, Extensions, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import type { CSSProperties } from 'react'

import type { TabRecord } from '../lib/types'

interface TabPaneProps {
  tab: TabRecord
  active: boolean
  extensions: Extensions
  editorProps: EditorOptions['editorProps']
  onReady: (id: string, editor: Editor) => void
  onDestroy: (id: string) => void
  onUpdate: (id: string) => void
}

export function TabPane({
  tab,
  active,
  extensions,
  editorProps,
  onReady,
  onDestroy,
  onUpdate,
}: TabPaneProps) {
  const editor = useEditor(
    {
      extensions,
      content: tab.document as JSONContent,
      autofocus: false,
      editorProps,
    },
    [tab.id],
  )

  useEffect(() => {
    if (!editor) return
    onReady(tab.id, editor)
    return () => {
      onDestroy(tab.id)
    }
  }, [editor, onDestroy, onReady, tab.id])

  useEffect(() => {
    if (!editor) return
    const handler = () => onUpdate(tab.id)
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [editor, onUpdate, tab.id])

  const layoutStyle: CSSProperties = {
    '--lwd-margin-top': `${tab.layout.margins.top}cm`,
    '--lwd-margin-right': `${tab.layout.margins.right}cm`,
    '--lwd-margin-bottom': `${tab.layout.margins.bottom}cm`,
    '--lwd-margin-left': `${tab.layout.margins.left}cm`,
    '--lwd-line-height': `${tab.layout.lineHeight}`,
    '--lwd-first-indent': `${tab.layout.firstLineIndent}em`,
    '--lwd-font-size': `${tab.layout.fontSize}px`,
  } as CSSProperties
  if (tab.layout.fontFamily) {
    const styleRecord = layoutStyle as Record<string, string>
    styleRecord['--lwd-font-family'] = tab.layout.fontFamily
  }

  return (
    <section
      className={`tab-pane${active ? ' is-active' : ''}`}
      data-tab-id={tab.id}
      aria-hidden={!active}
    >
      <div className="page-shell">
        <div className="paper" style={layoutStyle}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  )
}
