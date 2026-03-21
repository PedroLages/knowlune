import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MarkdownRenderer } from '../MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('renders fenced code blocks in <pre> with bg-surface-sunken', () => {
    const { container } = render(<MarkdownRenderer content={'```\nconst x = 1;\n```'} />)

    const pre = container.querySelector('pre')
    expect(pre).toBeInTheDocument()
    expect(pre?.className).toContain('bg-surface-sunken')
    expect(pre?.className).toContain('overflow-x-auto')

    const code = pre?.querySelector('code')
    expect(code).toBeInTheDocument()
  })

  it('renders inline code with bg-muted styling', () => {
    const { container } = render(<MarkdownRenderer content="Use `console.log` to debug" />)

    const code = container.querySelector('code')
    expect(code).toBeInTheDocument()
    expect(code?.className).toContain('bg-muted')
    expect(code?.className).toContain('font-mono')
    expect(code?.className).toContain('rounded')
    expect(code?.textContent).toBe('console.log')
  })

  it('renders unordered lists with list-disc', () => {
    const { container } = render(<MarkdownRenderer content={'- Item one\n- Item two'} />)

    const ul = container.querySelector('ul')
    expect(ul).toBeInTheDocument()
    expect(ul?.className).toContain('list-disc')
    expect(ul?.className).toContain('ml-6')

    const items = ul?.querySelectorAll('li')
    expect(items).toHaveLength(2)
  })

  it('renders ordered lists with list-decimal', () => {
    const { container } = render(<MarkdownRenderer content={'1. First\n2. Second'} />)

    const ol = container.querySelector('ol')
    expect(ol).toBeInTheDocument()
    expect(ol?.className).toContain('list-decimal')
    expect(ol?.className).toContain('ml-6')
  })

  it('renders bold text as <strong>', () => {
    const { container } = render(<MarkdownRenderer content="This is **bold** text" />)

    const strong = container.querySelector('strong')
    expect(strong).toBeInTheDocument()
    expect(strong?.textContent).toBe('bold')
  })

  it('renders italic text as <em>', () => {
    const { container } = render(<MarkdownRenderer content="This is *italic* text" />)

    const em = container.querySelector('em')
    expect(em).toBeInTheDocument()
    expect(em?.textContent).toBe('italic')
  })

  it('renders paragraphs with my-2 spacing', () => {
    const { container } = render(<MarkdownRenderer content={'Paragraph one\n\nParagraph two'} />)

    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs.length).toBeGreaterThanOrEqual(2)
    paragraphs.forEach(p => {
      expect(p.className).toContain('my-2')
    })
  })

  it('applies className prop to wrapper div', () => {
    const { container } = render(<MarkdownRenderer content="Hello" className="custom-class" />)

    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('custom-class')
  })

  it('resets inline code styles inside <pre> blocks', () => {
    const { container } = render(<MarkdownRenderer content={'```javascript\nconst x = 1;\n```'} />)

    const pre = container.querySelector('pre')
    expect(pre).toBeInTheDocument()
    // Pre should reset child code styles via [&>code] utility classes
    expect(pre?.className).toContain('[&>code]:bg-transparent')
    expect(pre?.className).toContain('[&>code]:p-0')
  })
})
