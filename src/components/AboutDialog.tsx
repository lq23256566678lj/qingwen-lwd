import { Modal } from './Modal'

export function AboutDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title="关于轻文"
      subtitle="写作，应该轻一点。"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          知道了
        </button>
      }
    >
      <div className="about-hero">
        <span className="about-mark" aria-hidden="true">
          文
        </span>
        <div>
          <div className="about-name">轻文 LWD</div>
          <div className="about-version">版本 0.3.0 · Tauri 2 + TipTap 3</div>
        </div>
      </div>
      <p className="about-text">
        一款面向长文写作的轻量级富文本编辑器。文档保存为自包含的
        <code>.lwd</code> JSON 文件，不依赖 Office，也不会被复杂的排版功能打断思路。
      </p>
      <div className="about-tags">
        <span>Rust</span>
        <span>React</span>
        <span>ProseMirror</span>
        <span>离线优先</span>
      </div>
      <p className="about-footnote">
        图片以 data URL 内嵌在文档中；标签页树与自动保存会话位于系统应用数据目录。
      </p>
    </Modal>
  )
}
