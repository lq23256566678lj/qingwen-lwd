import { useEffect, useState } from 'react'

import { Modal } from './Modal'

interface LinkDialogProps {
  open: boolean
  initialUrl: string
  hasLink: boolean
  onApply: (url: string | null) => void
  onClose: () => void
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null
  return `https://${trimmed}`
}

export function LinkDialog({
  open,
  initialUrl,
  hasLink,
  onApply,
  onClose,
}: LinkDialogProps) {
  const [value, setValue] = useState(initialUrl)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setValue(initialUrl)
      setError('')
    }
  }, [open, initialUrl])

  const apply = () => {
    if (!value.trim()) {
      onApply(null)
      onClose()
      return
    }
    const url = normalizeUrl(value)
    if (!url) {
      setError('请输入 http(s)、mailto 或 tel 链接')
      return
    }
    onApply(url)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={hasLink ? '编辑链接' : '插入链接'}
      subtitle="链接会保留在文档中；出于安全考虑，轻文不会在应用内直接打开它。"
      onClose={onClose}
      footer={
        <>
          {hasLink ? (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={() => {
                onApply(null)
                onClose()
              }}
            >
              移除链接
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            应用
          </button>
        </>
      }
    >
      <label className="field-label" htmlFor="lwd-link-input">
        链接地址
      </label>
      <input
        id="lwd-link-input"
        className="text-input"
        type="url"
        value={value}
        placeholder="https://example.com"
        spellCheck={false}
        data-autofocus
        onChange={(event) => {
          setValue(event.target.value)
          setError('')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            apply()
          }
        }}
      />
      {error ? <p className="field-error">{error}</p> : null}
      <p className="field-hint">
        不填写协议时会自动补全 https://；留空并应用可移除当前链接。
      </p>
    </Modal>
  )
}
