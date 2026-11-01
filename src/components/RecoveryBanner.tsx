import { History, X } from 'lucide-react'

import { formatDateTime } from '../lib/text'
import type { DraftPayload } from '../lib/types'

interface RecoveryBannerProps {
  draft: DraftPayload
  onRestore: () => void
  onDiscard: () => void
  onDismiss: () => void
}

export function RecoveryBanner({
  draft,
  onRestore,
  onDiscard,
  onDismiss,
}: RecoveryBannerProps) {
  return (
    <div className="recovery-banner" role="status">
      <span className="recovery-icon">
        <History size={17} />
      </span>
      <div className="recovery-text">
        <strong>发现自动保存的草稿</strong>
        <span>
          {formatDateTime(draft.savedAt)}
          {draft.filePath ? ` · ${draft.filePath}` : ' · 未命名文档'}
        </span>
      </div>
      <div className="recovery-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={onDiscard}>
          忽略
        </button>
        <button type="button" className="btn btn-primary btn-small" onClick={onRestore}>
          恢复草稿
        </button>
        <button
          type="button"
          className="icon-btn"
          title="关闭提示（保留草稿）"
          aria-label="关闭提示"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
