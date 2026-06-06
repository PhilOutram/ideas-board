import { useState } from 'react'
import { VERSION } from '../version'
import ChangelogModal from './ChangelogModal'

type Props = {
  size?: 'sm' | 'lg'
}

export default function AppTitle({ size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)

  const className = size === 'lg' ? 'app-title app-title-lg' : 'app-title'

  return (
    <>
      <h1 className={className}>
        Ideas Board
        <button
          type="button"
          className="version-chip"
          onClick={() => setOpen(true)}
          aria-label={`Version ${VERSION}. Click to see changelog.`}
        >
          {VERSION}
        </button>
      </h1>
      {open && <ChangelogModal onClose={() => setOpen(false)} />}
    </>
  )
}
