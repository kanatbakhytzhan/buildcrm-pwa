import { useState } from 'react'
import { MoreVertical } from 'lucide-react'

type ThreeDotsMenuItem = {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}

type ThreeDotsMenuProps = {
  items: ThreeDotsMenuItem[]
}

const ThreeDotsMenu = ({ items }: ThreeDotsMenuProps) => {
  const [open, setOpen] = useState(false)

  const handleItemClick = (item: ThreeDotsMenuItem) => {
    item.onClick()
    setOpen(false)
  }

  return (
    <div className="menu-wrapper">
      <button
        className="menu-trigger"
        type="button"
        aria-label="Меню"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="menu-dropdown">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`menu-item ${item.tone === 'danger' ? 'danger' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ThreeDotsMenu
