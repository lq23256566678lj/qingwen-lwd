import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useEffect } from 'react'

import type { ToastMessage } from '../lib/types'

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: number) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 4200)
    return () => window.clearTimeout(timer)
  }, [toast.id, onDismiss])

  const Icon =
    toast.kind === 'success'
      ? CircleCheck
      : toast.kind === 'error'
        ? CircleAlert
        : Info

  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <Icon size={16} className="toast-icon" />
      <span className="toast-text">{toast.text}</span>
      <button
        type="button"
        className="toast-close"
        title="关闭"
        aria-label="关闭提示"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
