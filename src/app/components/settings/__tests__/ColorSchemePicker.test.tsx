import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
vi.mock('@/lib/settings', () => ({
  saveSettings: vi.fn(),
  saveSettingsToSupabase: vi.fn(),
}))

import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'
import { ColorSchemePicker } from '../ColorSchemePicker'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useEngagementPrefsStore.setState({
    achievements: true,
    streaks: true,
    badges: true,
    animations: true,
    colorScheme: 'professional',
    courseViewMode: 'grid',
    courseGridColumns: 'auto',
  })
})

describe('ColorSchemePicker', () => {
  it('renders all 4 scheme options', () => {
    render(<ColorSchemePicker />)
    expect(screen.getByText('Professional')).toBeInTheDocument()
    expect(screen.getByText('Vibrant')).toBeInTheDocument()
    expect(screen.getByText('Clean')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('selecting Apple calls setPreference with "apple"', async () => {
    const user = userEvent.setup()
    const setPreferenceSpy = vi.spyOn(useEngagementPrefsStore.getState(), 'setPreference')

    render(<ColorSchemePicker />)

    // Click the Apple label
    const appleLabel = screen.getByText('Apple').closest('label')!
    await user.click(appleLabel)

    expect(setPreferenceSpy).toHaveBeenCalledWith('colorScheme', 'apple')
  })

  it('shows check mark on the currently selected scheme', () => {
    useEngagementPrefsStore.setState({ colorScheme: 'apple' })
    render(<ColorSchemePicker />)

    // The Check (lucide-react) badge renders a check icon as an SVG with
    // specific stroke attributes. Only the selected scheme shows this.
    const container = screen.getByTestId('color-scheme-picker')
    const checkSvgs = container.querySelectorAll('svg.lucide-check')
    expect(checkSvgs.length).toBe(1)
  })

  it('renders with 2-column grid on mobile and 4-column on desktop', () => {
    render(<ColorSchemePicker />)
    const container = screen.getByTestId('color-scheme-picker')
    expect(container.className).toContain('grid-cols-2')
    expect(container.className).toContain('lg:grid-cols-4')
  })

  it('selecting Clean calls setPreference with "clean"', async () => {
    const user = userEvent.setup()
    const setPreferenceSpy = vi.spyOn(useEngagementPrefsStore.getState(), 'setPreference')

    render(<ColorSchemePicker />)

    const cleanLabel = screen.getByText('Clean').closest('label')!
    await user.click(cleanLabel)

    expect(setPreferenceSpy).toHaveBeenCalledWith('colorScheme', 'clean')
  })
})
