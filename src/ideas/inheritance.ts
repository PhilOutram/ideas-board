import type { Page } from '../pages/usePages'

// One ancestor's contribution to an idea's inherited memory. Kept as a list
// (not a single string) so deeper nesting - sub-pages, sub-ideas (Phase 2) -
// can prepend more ancestors without changing how callers render or export.
export type MemorySource = {
  // Where this memory came from, e.g. "Page: Games". Shown to the user and
  // used as the section heading in markdown export (step 8).
  label: string
  memory: string
}

// Memory inheritance (brief 4a, Option A): a child idea inherits its parent
// page's memory. Conflict handling is presentational - the idea's own Memory
// board is rendered/exported after the inherited block and "wins" by being
// the more local, editable value; we don't merge line by line.
//
// Computed at read time, never stored: editing a page's memory cascades to
// its ideas automatically because there's no copied data to keep in sync.
//
// Ordered furthest ancestor first, so when deeper levels arrive the nearest
// ancestor sits closest to the idea's own memory.
export function inheritedMemory(page: Page): MemorySource[] {
  const sources: MemorySource[] = []
  if (page.memory.trim()) {
    sources.push({ label: `Page: ${page.title || 'untitled'}`, memory: page.memory })
  }
  return sources
}
