import type { ReactElement, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TopicTreemap, type TreemapDataItem } from '../TopicTreemap'

const treemapPropsHistory: Array<Record<string, unknown>> = []

function latestTreemapProps() {
  return treemapPropsHistory[treemapPropsHistory.length - 1]
}

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Treemap: (props: Record<string, unknown>) => {
    treemapPropsHistory.push(props)

    const content = props.content as ReactElement
    const Content = content.type as React.ComponentType<Record<string, unknown>>

    return (
      <svg>
        <Content
          x={0}
          y={0}
          width={240}
          height={160}
          depth={1}
          name="TypeScript"
          canonicalName="typescript"
          category="Programming"
          score={82}
          tier="strong"
          aggregateRetention={null}
          predictedDecayDate={null}
          onCellClick={props.onCellClick}
        />
      </svg>
    )
  },
}))

vi.mock('@/app/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const DATA: TreemapDataItem[] = [
  {
    name: 'TypeScript',
    canonicalName: 'typescript',
    category: 'Programming',
    size: 1,
    score: 82,
    tier: 'strong',
    aggregateRetention: null,
    predictedDecayDate: null,
  },
]

describe('TopicTreemap stability', () => {
  beforeEach(() => {
    treemapPropsHistory.length = 0
  })

  it('disables Recharts transitions that restart during responsive measurements', () => {
    render(<TopicTreemap data={DATA} />)

    const props = latestTreemapProps()
    expect(props?.isAnimationActive).toBe(false)
    expect(props?.isUpdateAnimationActive).toBe(false)
  })

  it('keeps enriched data stable across unrelated rerenders', () => {
    const onCellClick = vi.fn()
    const { rerender } = render(<TopicTreemap data={DATA} onCellClick={onCellClick} />)
    const initialData = latestTreemapProps()?.data

    rerender(<TopicTreemap data={DATA} onCellClick={onCellClick} />)

    expect(latestTreemapProps()?.data).toBe(initialData)
  })

  it('treats depth-one flat data as an interactive topic', () => {
    render(<TopicTreemap data={DATA} />)

    expect(
      screen.getByRole('button', {
        name: 'Topic: TypeScript, category: Programming, knowledge score: 82 percent, status: strong',
      })
    ).toBeInTheDocument()
  })
})
