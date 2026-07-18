import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardCustomizer } from '../DashboardCustomizer'
import {
  DEFAULT_ORDER,
  getPresetPreferences,
  type DashboardPreset,
  type DashboardSectionId,
} from '@/lib/dashboardOrder'

function CustomizerHarness() {
  const [preset, setPreset] = useState<DashboardPreset>('balanced')
  const [order, setOrder] = useState<DashboardSectionId[]>([...DEFAULT_ORDER])
  const [hidden, setHidden] = useState<DashboardSectionId[]>([])

  const applyPreset = (nextPreset: Exclude<DashboardPreset, 'custom'>) => {
    const preferences = getPresetPreferences(nextPreset)
    setPreset(nextPreset)
    setOrder(preferences.order)
    setHidden(preferences.hidden)
  }

  return (
    <DashboardCustomizer
      sectionOrder={order}
      hiddenSections={new Set(hidden)}
      preset={preset}
      isOpen
      onClose={() => undefined}
      onPreset={applyPreset}
      onVisibility={(sectionId, visible) => {
        setPreset('custom')
        setHidden(current =>
          visible ? current.filter(id => id !== sectionId) : [...current, sectionId]
        )
      }}
      onReorder={newOrder => {
        setPreset('custom')
        setOrder(newOrder)
      }}
      onReset={() => applyPreset('balanced')}
    />
  )
}

describe('DashboardCustomizer', () => {
  it('applies presets, supports show/hide, and resets to Balanced', () => {
    render(<CustomizerHarness />)

    fireEvent.click(screen.getByTestId('dashboard-preset-focus'))
    expect(screen.getByTestId('dashboard-preset-focus')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Show Learning Insights' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Learning Insights' }))
    expect(screen.getByText('Custom layout')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show Learning Insights' })).toBeChecked()

    fireEvent.click(screen.getByTestId('reset-dashboard-order'))
    expect(screen.getByTestId('dashboard-preset-balanced')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(
      screen
        .getAllByRole('checkbox')
        .every(checkbox => checkbox.getAttribute('data-state') === 'checked')
    ).toBe(true)
  })

  it('offers move buttons as an alternative to dragging', () => {
    render(<CustomizerHarness />)
    const list = screen.getByRole('list', { name: 'Overview sections' })
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Learning Focus')

    fireEvent.click(screen.getByRole('button', { name: 'Move Learning Focus down' }))

    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Learning Pulse')
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('Learning Focus')
    expect(screen.getByText('Custom layout')).toBeInTheDocument()
  })
})
