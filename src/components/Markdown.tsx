import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renders a markdown string as HTML. remark-gfm adds GitHub-flavoured markdown:
// tables, task lists, strikethrough, autolinks - which the design book leans on
// heavily (it's table-heavy). Styling lives under .markdown-body in index.css.
export default function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
}
