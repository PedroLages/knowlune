import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/lib/settings', () => ({
  getSettings: () => ({
    displayName: 'Student',
    bio: '',
    theme: 'system',
  }),
  saveSettings: vi.fn(),
  exportAllData: () => '{}',
  importAllData: vi.fn(() => true),
  resetAllData: vi.fn(),
}))

vi.mock('@/app/components/figma/ReminderSettings', () => ({
  ReminderSettings: () => <div data-testid="reminder-settings" />,
}))

import Settings from '../Settings'

describe('Settings page', () => {
  it('renders without crashing', () => {
    const { container } = render(<Settings />)
    expect(container).toBeTruthy()
  })

  it('displays the page heading "Settings"', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders Profile, Appearance, and Data Management sections', () => {
    render(<Settings />)
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Data Management')).toBeInTheDocument()
  })

  it('renders the Display Name input with default value', () => {
    render(<Settings />)
    const nameInput = screen.getByLabelText('Display Name')
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveValue('Student')
  })
})
