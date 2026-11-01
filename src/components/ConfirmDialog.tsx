import { Modal } from './Modal'
import { Spinner } from './ui'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  busy: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  busy,
  onSave,
  onDiscard,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      dismissible={!busy}
      width={460}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={onDiscard}
            disabled={busy}
          >
            放弃修改
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={busy}
            data-autofocus
          >
            {busy ? <Spinner /> : null}
            保存并继续
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
      <p className="confirm-hint">
        选择“保存并继续”会先写入 .lwd 文件；选择“放弃修改”会丢弃当前更改。
      </p>
    </Modal>
  )
}
