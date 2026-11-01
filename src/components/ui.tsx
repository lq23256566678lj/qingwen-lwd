import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface ToolButtonProps {
  icon?: LucideIcon
  label: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  children?: ReactNode
}

export function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  className = '',
  children,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {Icon ? <Icon size={16} strokeWidth={1.9} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

interface PopoverProps {
  trigger: (open: boolean) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  panelClassName?: string
}

export function Popover({
  trigger,
  children,
  align = 'left',
  panelClassName = '',
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="popover" ref={rootRef}>
      <div
        className="popover-trigger"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger(open)}
      </div>
      {open ? (
        <div
          className={`popover-panel popover-${align}${panelClassName ? ` ${panelClassName}` : ''}`}
          role="menu"
        >
          {typeof children === 'function'
            ? children(() => setOpen(false))
            : children}
        </div>
      ) : null}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 className="spin" size={size} aria-hidden="true" />
}
