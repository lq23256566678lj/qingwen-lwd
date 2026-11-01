import { Modal } from './Modal'
import { Kbd } from './ui'
import { shortcutLabel } from '../lib/platform'

const GROUPS: { title: string; items: { keys: string; action: string }[] }[] = [
  {
    title: '文件',
    items: [
      { keys: 'Mod+N', action: '新建文档' },
      { keys: 'Mod+O', action: '打开 .lwd 文档' },
      { keys: 'Mod+S', action: '保存' },
      { keys: 'Mod+Shift+S', action: '另存为' },
      { keys: 'Mod+W', action: '关闭窗口' },
    ],
  },
  {
    title: '编辑',
    items: [
      { keys: 'Mod+Z', action: '撤销' },
      { keys: 'Mod+Shift+Z', action: '重做（Windows 也可用 Ctrl+Y）' },
      { keys: 'Mod+F', action: '查找' },
      { keys: 'Mod+H', action: '查找和替换' },
      { keys: 'Mod+A', action: '全选' },
    ],
  },
  {
    title: '格式',
    items: [
      { keys: 'Mod+B', action: '加粗' },
      { keys: 'Mod+I', action: '斜体' },
      { keys: 'Mod+U', action: '下划线' },
      { keys: 'Mod+Shift+X', action: '删除线' },
      { keys: 'Mod+Shift+H', action: '高亮' },
      { keys: 'Mod+Alt+1', action: '标题 1（2–4 同理）' },
      { keys: 'Mod+Alt+0', action: '正文' },
      { keys: 'Mod+Shift+8', action: '项目符号列表' },
      { keys: 'Mod+Shift+7', action: '编号列表' },
      { keys: 'Mod+Alt+C', action: '代码块' },
    ],
  },
]

export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title="键盘快捷键"
      subtitle="macOS 使用 ⌘，Windows / Linux 使用 Ctrl"
      onClose={onClose}
      width={620}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          知道了
        </button>
      }
    >
      <div className="shortcuts-grid">
        {GROUPS.map((group) => (
          <section key={group.title} className="shortcut-group">
            <h3 className="shortcut-title">{group.title}</h3>
            <dl className="shortcut-list">
              {group.items.map((item) => (
                <div className="shortcut-row" key={item.keys + item.action}>
                  <dt>{item.action}</dt>
                  <dd>
                    <Kbd>{shortcutLabel(item.keys)}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}
