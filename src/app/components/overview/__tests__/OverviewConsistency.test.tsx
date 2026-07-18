import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FIXED_DATE } from '../../../../../tests/utils/test-time'
import type { DashboardHeatmapDay } from '@/lib/overviewDashboard'
import { OverviewConsistency } from '../OverviewConsistency'

const DAY_MS = 24 * 60 * 60 * 1000

function heatmapDays(): DashboardHeatmapDay[] {
  const today = new Date(FIXED_DATE)
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(today.getTime() - (83 - index) * DAY_MS)
    return {
      date: date.toISOString().slice(0, 10),
      minutes: index,
      level: index === 0 ? 0 : index < 21 ? 1 : index < 42 ? 2 : index < 63 ? 3 : 4,
      isToday: index === 83,
    } as DashboardHeatmapDay
  })
}

describe('OverviewConsistency', () => {
  it('exposes one tabbable heatmap cell and supports day and week navigation', () => {
    render(
      <MemoryRouter>
        <OverviewConsistency heatmap={heatmapDays()} recentActivity={[]} />
      </MemoryRouter>
    )

    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(84)
    expect(cells.filter(cell => cell.getAttribute('tabindex') === '0')).toHaveLength(1)

    const today = cells[83]
    today.focus()
    fireEvent.keyDown(today, { key: 'ArrowLeft' })
    expect(cells[76]).toHaveFocus()

    fireEvent.keyDown(cells[76], { key: 'ArrowUp' })
    expect(cells[75]).toHaveFocus()
    expect(screen.getByText(/75 min$/)).toBeInTheDocument()

    fireEvent.keyDown(cells[75], { key: 'Home' })
    expect(cells[0]).toHaveFocus()
    expect(cells.filter(cell => cell.getAttribute('tabindex') === '0')).toHaveLength(1)
  })
})
