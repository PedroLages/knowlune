import { NodeViewWrapper, NodeViewContent, type ReactNodeViewProps } from '@tiptap/react'

const LANGUAGES = [
  { value: '', label: 'Plain text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'bash', label: 'Bash' },
] as const

export function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="code-block-wrapper">
      <select
        contentEditable={false}
        value={node.attrs.language || ''}
        onChange={e => updateAttributes({ language: e.target.value })}
        aria-label="Code language"
        data-testid="code-block-language-select"
        className="absolute top-2 right-2 text-xs px-1.5 py-0.5 border border-border rounded bg-background text-foreground cursor-pointer"
      >
        {LANGUAGES.map(lang => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre>
        <NodeViewContent<'code'>
          as="code"
          className={node.attrs.language ? `language-${node.attrs.language}` : undefined}
        />
      </pre>
    </NodeViewWrapper>
  )
}
