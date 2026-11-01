export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

export const IS_WINDOWS =
  typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent)

/**
 * Tauri 会在 WebView 中注入 __TAURI_INTERNALS__。浏览器里直接打开 Vite 页面时，
 * 应用仍可渲染与编辑，但文件/自动保存等桌面能力会被安全地禁用。
 */
export const IS_TAURI =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl'
export const SHIFT_LABEL = IS_MAC ? '⇧' : 'Shift'
export const ALT_LABEL = IS_MAC ? '⌥' : 'Alt'

/** 把 "Mod+Shift+S" 渲染成平台习惯的快捷键提示。 */
export function shortcutLabel(keys: string): string {
  const tokens = keys.split('+')
  const mapped = tokens.map((token) => {
    switch (token) {
      case 'Mod':
        return MOD_LABEL
      case 'Shift':
        return SHIFT_LABEL
      case 'Alt':
        return ALT_LABEL
      default:
        return token
    }
  })
  return IS_MAC ? mapped.join('') : mapped.join('+')
}
