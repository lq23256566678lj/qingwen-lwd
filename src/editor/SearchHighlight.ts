import { Extension, type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface SearchMatch {
  from: number
  to: number
}

export interface SearchState {
  query: string
  caseSensitive: boolean
  matches: SearchMatch[]
  activeIndex: number
}

export interface SearchPatch {
  query?: string
  caseSensitive?: boolean
  activeIndex?: number
  clear?: boolean
}

const EMPTY_STATE: SearchState = {
  query: '',
  caseSensitive: false,
  matches: [],
  activeIndex: 0,
}

export const searchPluginKey = new PluginKey<SearchState>('lwdSearch')

/**
 * 把每个文本块内连续的文本节点拼成一个字符串，同时记录每个字符的文档位置。
 * 这样跨加粗/斜体等 mark 的词组也能被完整搜索到；块与块之间不跨越。
 */
function collectMatches(
  doc: PMNode,
  rawQuery: string,
  caseSensitive: boolean,
): SearchMatch[] {
  const query = caseSensitive ? rawQuery : rawQuery.toLowerCase()
  if (!query) return []

  const matches: SearchMatch[] = []
  let buffer = ''
  let positions: number[] = []

  const flush = () => {
    if (buffer) {
      const haystack = caseSensitive ? buffer : buffer.toLowerCase()
      let index = haystack.indexOf(query)
      const step = Math.max(1, query.length)
      while (index !== -1) {
        const start = positions[index]
        const end = positions[index + query.length - 1]
        if (start !== undefined && end !== undefined) {
          matches.push({ from: start, to: end + 1 })
        }
        index = haystack.indexOf(query, index + step)
      }
    }
    buffer = ''
    positions = []
  }

  doc.descendants((node, pos) => {
    if (node.isBlock) {
      flush()
      return true
    }
    if (node.isText) {
      const text = node.text ?? ''
      buffer += text
      for (let offset = 0; offset < text.length; offset += 1) {
        positions.push(pos + offset)
      }
      return false
    }
    if (node.isLeaf) {
      // 图片、硬换行等行内叶子节点会打断连续性，避免把两侧文字错误拼接。
      flush()
    }
    return false
  })
  flush()

  return matches
}

/**
 * 搜索高亮插件：只保存查询与命中范围，装饰由每次 state 计算，不写入文档，
 * 因此不会被自动保存、撤销栈或 .lwd 序列化污染。
 */
export const SearchHighlight = Extension.create({
  name: 'lwdSearch',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchPluginKey,
        state: {
          init: () => EMPTY_STATE,
          apply(transaction, previous) {
            const patch = transaction.getMeta(searchPluginKey) as
              | SearchPatch
              | undefined

            if (patch?.clear) return EMPTY_STATE
            if (!patch && !transaction.docChanged) return previous

            const query = patch?.query ?? previous.query
            const caseSensitive =
              patch?.caseSensitive ?? previous.caseSensitive
            const changed =
              query !== previous.query ||
              caseSensitive !== previous.caseSensitive

            const matches =
              query.length > 0
                ? collectMatches(transaction.doc, query, caseSensitive)
                : []

            let activeIndex =
              patch?.activeIndex ?? (changed ? 0 : previous.activeIndex)
            if (matches.length === 0) activeIndex = 0
            else {
              activeIndex = Math.min(
                Math.max(activeIndex, 0),
                matches.length - 1,
              )
            }

            return { query, caseSensitive, matches, activeIndex }
          },
        },
        props: {
          decorations(state) {
            const search = searchPluginKey.getState(state)
            if (!search || search.matches.length === 0) return null
            const decorations = search.matches.map((match, index) =>
              Decoration.inline(match.from, match.to, {
                class:
                  index === search.activeIndex
                    ? 'lwd-search-hit is-active'
                    : 'lwd-search-hit',
                'data-search-index': String(index),
              }),
            )
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

export function getSearchState(editor: Editor): SearchState | undefined {
  return searchPluginKey.getState(editor.state)
}

export function updateSearch(editor: Editor, patch: SearchPatch): void {
  const transaction = editor.state.tr.setMeta(searchPluginKey, patch)
  editor.view.dispatch(transaction)
}

export function scrollToSearchMatch(editor: Editor, index: number): void {
  const element = editor.view.dom.querySelector<HTMLElement>(
    `[data-search-index="${index}"]`,
  )
  element?.scrollIntoView({ block: 'center', inline: 'nearest' })
}

export function replaceSearchMatch(
  editor: Editor,
  match: SearchMatch,
  replacement: string,
): void {
  const transaction = editor.state.tr.insertText(
    replacement,
    match.from,
    match.to,
  )
  editor.view.dispatch(transaction)
}

export function replaceAllSearchMatches(
  editor: Editor,
  matches: SearchMatch[],
  replacement: string,
): number {
  if (matches.length === 0) return 0
  const transaction = editor.state.tr
  // 从后往前替换，前面的文档位置不会被后续修改影响。
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    transaction.insertText(replacement, match.from, match.to)
  }
  editor.view.dispatch(transaction)
  return matches.length
}
