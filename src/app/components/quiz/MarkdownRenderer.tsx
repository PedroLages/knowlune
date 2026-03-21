import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const remarkPlugins = [remarkGfm]

/**
 * Styled Markdown component overrides using LevelUp design tokens.
 *
 * Inline vs block code: Both render as <code>, but block code lives inside
 * <pre>. We style <code> for inline use (bg-muted, padding, rounded) and
 * reset those styles on <pre code> via the pre component's own styling.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="my-2">{children}</p>,
  pre: ({ children }) => (
    <pre className="bg-surface-sunken rounded-lg p-4 overflow-x-auto my-3 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-sm">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code
      className={
        className
          ? `text-foreground font-mono text-sm ${className}`
          : 'bg-muted text-foreground font-mono text-[0.875em] px-1.5 py-0.5 rounded'
      }
    >
      {children}
    </code>
  ),
  ul: ({ children }) => <ul className="ml-6 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="ml-6 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="text-foreground">{children}</li>,
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
        {content}
      </Markdown>
    </div>
  )
}
