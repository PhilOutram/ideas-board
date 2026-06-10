import type { Page } from '../pages/usePages'
import { ancestorsOf } from '../pages/pageTree'

// One ancestor's contribution to an idea's inherited memory. Kept as a list
// (not a single string) so deeper nesting can contribute multiple ancestors,
// and so step-8 export can render each section.
export type MemorySource = {
  // Where this memory came from, e.g. "Page: Games". Shown to the user and
  // used as the section heading in markdown export.
  label: string
  memory: string
}

// Memory inheritance (brief 4a, Option A), now cascading down the full page
// tree: a child idea inherits the memory of its parent page AND every ancestor
// page above it. Ordered furthest ancestor first, the idea's own page last
// (nearest), so the most local memory reads closest to the idea and "wins" by
// position. Conflict handling stays presentational - we don't merge line by
// line. Computed at read time, never stored, so edits anywhere up the chain
// cascade automatically.
export function inheritedMemory(page: Page, allPages: Page[]): MemorySource[] {
  // root -> ... -> parent -> page (the idea's own page is the nearest source)
  const chain = [...ancestorsOf(page.id, allPages), page]
  return chain
    .filter((p) => p.memory.trim())
    .map((p) => ({ label: `Page: ${p.title || 'untitled'}`, memory: p.memory }))
}

// Inherited memory for a page itself (its ancestors only - the page's own
// memory is shown separately in its editor). Used to surface cascade on the
// page view.
export function inheritedMemoryForPage(page: Page, allPages: Page[]): MemorySource[] {
  return ancestorsOf(page.id, allPages)
    .filter((p) => p.memory.trim())
    .map((p) => ({ label: `Page: ${p.title || 'untitled'}`, memory: p.memory }))
}
