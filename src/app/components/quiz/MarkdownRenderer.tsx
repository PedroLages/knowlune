import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/app/components/ui/utils'

const remarkPlugins = [remarkGfm]

/**
 * Styled Markdown component overrides using EduVi design tokens.
 *
 * Inline vs block code: Both render as <code>, but block code lives inside
 * <pre>. The pre component fully styles block code (bg-surface-sunken, reset
 * inline styles). The code component only applies inline code styling.
 *
 * Links are rendered as plain text to prevent navigation away from quiz.
 * Images are constrained to container width. Tables get horizontal scroll.
 *
 * Intentionally NOT using rehype-raw — raw HTML is stripped for safety.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="my-2 text-pretty">{children}</p>,
  pre: ({ children }) => (
    <pre className="bg-surface-sunken rounded-lg p-4 overflow-x-auto my-3 max-w-full [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-sm">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code
      className={cn(
        'text-foreground font-mono',
        className ? ['text-sm', className] : 'bg-muted text-[0.875em] px-1.5 py-0.5 rounded'
      )}
    >
      {children}
    </code>
  ),
  ul: ({ children }) => <ul className="ml-6 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="ml-6 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="text-foreground">{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  // Render links as plain text to prevent navigating away from quiz
  a: ({ children }) => <span className="text-foreground">{children}</span>,
  // Disable GFM task list checkboxes in read-only quiz context
  input: props => <input {...props} disabled />,
  // Constrain images to container width
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ''} className="max-w-full h-auto rounded my-2" />
  ),
  // Wrap tables in scrollable container for mobile
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      {/* Intentionally NOT using rehype-raw — raw HTML is stripped for safety */}
      <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
        {content ?? ''}
      </Markdown>
    </div>
  )
}
