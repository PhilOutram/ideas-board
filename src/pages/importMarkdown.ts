// Parse markdown into a nested section tree by its heading levels. Each
// heading (#, ##, ###, ...) becomes a node; the text beneath a heading (until
// the next heading) becomes that node's body. A heading nests under the
// nearest preceding heading of a smaller level. Deterministic - no AI.
export type ParsedNode = {
  title: string
  body: string
  children: ParsedNode[]
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/

export function parseMarkdownToTree(markdown: string): ParsedNode[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const roots: ParsedNode[] = []
  const stack: { level: number; node: ParsedNode }[] = []
  const preamble: string[] = []

  for (const line of lines) {
    const heading = HEADING_RE.exec(line)
    if (heading) {
      const level = heading[1].length
      const node: ParsedNode = { title: heading[2].trim(), body: '', children: [] }
      // Pop until the top of the stack is a strictly-shallower heading.
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
      if (stack.length === 0) roots.push(node)
      else stack[stack.length - 1].node.children.push(node)
      stack.push({ level, node })
    } else if (stack.length === 0) {
      preamble.push(line)
    } else {
      const current = stack[stack.length - 1].node
      current.body += (current.body ? '\n' : '') + line
    }
  }

  const trim = (n: ParsedNode) => {
    n.body = n.body.trim()
    n.children.forEach(trim)
  }
  roots.forEach(trim)

  // Any content before the first heading becomes a leading "Notes" section.
  const pre = preamble.join('\n').trim()
  if (pre) roots.unshift({ title: 'Notes', body: pre, children: [] })

  return roots
}

export function countNodes(nodes: ParsedNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0)
}
