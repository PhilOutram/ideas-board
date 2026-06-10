import { useState } from 'react'
import { copyToClipboard } from '../lib/clipboard'

type Props = {
  // Built lazily on click so it always reflects the latest content.
  getText: () => string
  label: string
  className?: string
  disabled?: boolean
}

export default function CopyButton({ getText, label, className, disabled }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function handleCopy() {
    const ok = await copyToClipboard(getText())
    setState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button type="button" className={className} onClick={handleCopy} disabled={disabled}>
      {state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : label}
    </button>
  )
}
