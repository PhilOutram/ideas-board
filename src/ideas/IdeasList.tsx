import { useState } from 'react'
import type { Idea, Temperature } from './useIdeas'
import { buildIdeaCard } from './exportForChat'
import CopyButton from '../components/CopyButton'

type Props = {
  ideas: Idea[]
  loading: boolean
  error: Error | null
  setTemperature: (id: string, temperature: Temperature) => Promise<void>
  onOpen: (id: string) => void
}

const TEMP_META: Record<Temperature, { icon: string; label: string }> = {
  hot: { icon: '🔥', label: 'Hot' },
  warm: { icon: '🟡', label: 'Warm' },
  cold: { icon: '❄️', label: 'Cold' },
}

// Clicking the badge heats an idea up a step, then wraps back to cold.
const NEXT_TEMP: Record<Temperature, Temperature> = {
  cold: 'warm',
  warm: 'hot',
  hot: 'cold',
}

// Hot floats to the top, then warm; cold is pulled out into its own section.
const RANK: Record<Temperature, number> = { hot: 0, warm: 1, cold: 2 }

function byTemperatureThenRecent(a: Idea, b: Idea): number {
  if (RANK[a.temperature] !== RANK[b.temperature]) {
    return RANK[a.temperature] - RANK[b.temperature]
  }
  const aEdited = a.lastEdited?.toMillis() ?? 0
  const bEdited = b.lastEdited?.toMillis() ?? 0
  return bEdited - aEdited
}

export default function IdeasList({ ideas, loading, error, setTemperature, onOpen }: Props) {
  // Cold ideas are never deleted, just de-emphasised into a collapsible
  // section that starts closed so warm/hot work stays front and centre.
  const [showCold, setShowCold] = useState(false)

  if (error) {
    return (
      <p className="auth-error" role="alert">Couldn't load ideas: {error.message}</p>
    )
  }

  if (loading) {
    return <p className="muted inbox-status">Loading ideas...</p>
  }

  if (ideas.length === 0) {
    return (
      <p className="muted ideas-empty">
        No ideas yet. Promote a quick idea from the inbox to start one.
      </p>
    )
  }

  const active = ideas.filter((i) => i.temperature !== 'cold').sort(byTemperatureThenRecent)
  const cold = ideas.filter((i) => i.temperature === 'cold').sort(byTemperatureThenRecent)

  return (
    <div className="ideas">
      <h3 className="ideas-heading">Ideas</h3>

      {active.length === 0 ? (
        <p className="muted ideas-empty">Every idea is cold right now.</p>
      ) : (
        <ul className="ideas-grid">
          {active.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              setTemperature={setTemperature}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      {cold.length > 0 && (
        <div className="ideas-cold">
          <button
            type="button"
            className="ideas-cold-toggle"
            aria-expanded={showCold}
            onClick={() => setShowCold((v) => !v)}
          >
            {showCold ? '▾' : '▸'} Cold / archived ({cold.length})
          </button>
          {showCold && (
            <ul className="ideas-grid">
              {cold.map((idea) => (
                <IdeaCard
              key={idea.id}
              idea={idea}
              setTemperature={setTemperature}
              onOpen={onOpen}
            />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

type CardProps = {
  idea: Idea
  setTemperature: (id: string, temperature: Temperature) => Promise<void>
  onOpen: (id: string) => void
}

function IdeaCard({ idea, setTemperature, onOpen }: CardProps) {
  const meta = TEMP_META[idea.temperature]
  const preview = idea.boards.messy.trim()

  async function cycleTemperature() {
    try {
      await setTemperature(idea.id, NEXT_TEMP[idea.temperature])
    } catch (err) {
      console.error('Failed to change temperature:', err)
    }
  }

  return (
    <li className={`idea-card idea-card-${idea.temperature}`}>
      <button
        type="button"
        className="idea-temp"
        title={`${meta.label} - click to change`}
        aria-label={`Temperature: ${meta.label}. Click to change.`}
        onClick={cycleTemperature}
      >
        <span aria-hidden="true">{meta.icon}</span>
      </button>
      <button
        type="button"
        className="idea-open"
        onClick={() => onOpen(idea.id)}
        aria-label={`Open idea: ${idea.title || 'untitled idea'}`}
      >
        <span className="idea-title">{idea.title || '(untitled idea)'}</span>
        {preview && <span className="idea-preview">{preview}</span>}
      </button>
      <CopyButton
        className="idea-copy"
        icon="📋"
        label="Copy idea as markdown"
        getText={() => buildIdeaCard(idea)}
      />
    </li>
  )
}
