import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SkillProficiencyRadar } from '../SkillProficiencyRadar'
import type { SkillProficiencyData } from '@/lib/reportStats'

// Mock recharts — follow Reports.test.tsx pattern
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    ...actual,
    ResponsiveContainer: Passthrough,
    RadarChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="radar-chart">{children}</div>
    ),
    Radar: () => null,
    PolarAngleAxis: () => null,
    PolarGrid: () => null,
    PolarRadiusAxis: () => null,
  }
})

const mockData: SkillProficiencyData[] = [
  { domain: 'Behavioral Analysis', proficiency: 80, fullMark: 100 },
  { domain: 'Confidence Mastery', proficiency: 60, fullMark: 100 },
  { domain: 'Operative Training', proficiency: 40, fullMark: 100 },
]

describe('SkillProficiencyRadar', () => {
  it('renders chart when data is provided', () => {
    render(<SkillProficiencyRadar data={mockData} />)
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument()
  })

  it('returns null when data is empty', () => {
    const { container } = render(<SkillProficiencyRadar data={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('provides accessible aria-label with proficiency summary', () => {
    render(<SkillProficiencyRadar data={mockData} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('Behavioral Analysis 80%'))
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('Confidence Mastery 60%'))
  })
})
