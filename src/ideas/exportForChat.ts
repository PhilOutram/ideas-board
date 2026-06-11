import type { Page } from '../pages/usePages'
import type { Idea, Temperature } from './useIdeas'

// Builds clean markdown for pasting an idea (or a whole page of ideas) into a
// Claude chat. Structure: a preamble (this is an idea I'm about to ask about),
// the page Context, the page Memory framed as protocols/reminders, then the
// idea(s) and their boards. Empty sections/boards are skipped.

const DEFAULT_BOARDS = ['messy', 'tidy', 'context', 'memory'] as const

const TEMP_LABEL: Record<Temperature, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

const PREAMBLE_SINGLE =
  "I'm developing an idea and I'd like your help thinking it through. Below is " +
  'the background context, some memory (protocols and reminders to keep in ' +
  "mind), and the idea itself. Please read it all, then I'll ask you questions " +
  'about it.'

const PREAMBLE_ALL =
  "I'm developing a set of ideas and I'd like your help thinking them through. " +
  'Below is the background context, some memory (protocols and reminders to ' +
  "keep in mind), and all the ideas. Please read them, then I'll ask you " +
  'questions.'

function labelForBoard(key: string): string {
  const words = key.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function boardKeys(idea: Idea): string[] {
  const custom = Object.keys(idea.boards).filter(
    (k) => !DEFAULT_BOARDS.includes(k as (typeof DEFAULT_BOARDS)[number]),
  )
  return [...DEFAULT_BOARDS, ...custom]
}

function sectionMarkdown(title: string, body: string): string {
  const text = body.trim()
  return text ? `## ${title}\n\n${text}` : ''
}

// `level` is the heading depth for the idea title, so a single export uses
// ## idea / ### boards and the all-ideas export nests one level deeper.
function ideaMarkdown(idea: Idea, level: number): string {
  const titleHash = '#'.repeat(level)
  const boardHash = '#'.repeat(level + 1)
  const lines = [
    `${titleHash} Idea: ${idea.title || '(untitled)'}`,
    '',
    `*Temperature: ${TEMP_LABEL[idea.temperature]}*`,
  ]
  for (const key of boardKeys(idea)) {
    const value = (idea.boards[key] ?? '').trim()
    if (value) lines.push('', `${boardHash} ${labelForBoard(key)}`, '', value)
  }
  return lines.join('\n')
}

function header(page: Page, preamble: string): string[] {
  return [
    `# ${page.title || 'Ideas'}`,
    preamble,
    sectionMarkdown('Context', page.context),
    sectionMarkdown('Memory - protocols & reminders', page.memory),
  ].filter(Boolean)
}

export function buildIdeaExport(page: Page, idea: Idea): string {
  return [...header(page, PREAMBLE_SINGLE), ideaMarkdown(idea, 2)].join('\n\n') + '\n'
}

// A lightweight copy of just one idea card - bold title then its non-empty
// boards - for dropping a single idea straight into a chat. No page context,
// preamble or memory: this is the "grab this card" shortcut on the card itself.
export function buildIdeaCard(idea: Idea): string {
  const parts = [`**${idea.title || '(untitled idea)'}**`]
  for (const key of boardKeys(idea)) {
    const value = (idea.boards[key] ?? '').trim()
    if (value) parts.push(`**${labelForBoard(key)}**\n\n${value}`)
  }
  return parts.join('\n\n') + '\n'
}

const RANK: Record<Temperature, number> = { hot: 0, warm: 1, cold: 2 }

export function buildPageExport(page: Page, ideas: Idea[]): string {
  // Same order the list shows: hot, then warm, then cold; recent first within.
  const sorted = [...ideas].sort((a, b) => {
    if (RANK[a.temperature] !== RANK[b.temperature]) {
      return RANK[a.temperature] - RANK[b.temperature]
    }
    return (b.lastEdited?.toMillis() ?? 0) - (a.lastEdited?.toMillis() ?? 0)
  })
  const ideasSection = sorted.length
    ? ['## Ideas', ...sorted.map((idea) => ideaMarkdown(idea, 3))].join('\n\n')
    : ''
  return [...header(page, PREAMBLE_ALL), ideasSection].filter(Boolean).join('\n\n') + '\n'
}
