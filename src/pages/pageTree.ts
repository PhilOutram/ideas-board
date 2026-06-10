import type { Page } from './usePages'

export type PageTreeNode = {
  page: Page
  children: PageTreeNode[]
}

// Build a nested tree from the flat owner-scoped page list, grouping by
// parentId and sorting siblings by `order`. Pages whose parentId points at a
// missing page (e.g. after a future delete/reparent) are treated as roots so
// nothing silently disappears.
export function buildTree(pages: Page[]): PageTreeNode[] {
  const ids = new Set(pages.map((p) => p.id))
  const byParent = new Map<string | null, Page[]>()

  for (const page of pages) {
    const key = page.parentId && ids.has(page.parentId) ? page.parentId : null
    const siblings = byParent.get(key) ?? []
    siblings.push(page)
    byParent.set(key, siblings)
  }

  const build = (parentId: string | null): PageTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((page) => ({ page, children: build(page.id) }))

  return build(null)
}

// Ancestors of a page, ordered root -> ... -> immediate parent (excludes the
// page itself). Cycle-guarded.
export function ancestorsOf(pageId: string, pages: Page[]): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const chain: Page[] = []
  const seen = new Set<string>()
  let currentId = byId.get(pageId)?.parentId ?? null

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    const parent = byId.get(currentId)
    if (!parent) break
    chain.push(parent)
    currentId = parent.parentId ?? null
  }

  return chain.reverse()
}
