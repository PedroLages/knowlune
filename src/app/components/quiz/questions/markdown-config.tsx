import remarkGfm from 'remark-gfm'

export const REMARK_PLUGINS = [remarkGfm]

// Render inline <span> instead of block <p> inside <legend> (phrasing content only)
export const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}
