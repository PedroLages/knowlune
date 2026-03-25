import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/lib/settings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings')>()
  return {
    ...actual,
    getSettings: () => ({
      displayName: 'Student',
      bio: '',
      theme: 'system',
    }),
    saveSettings: vi.fn(),
    exportAllData: () => '{}',
    importAllData: vi.fn(() => true),
    resetAllData: vi.fn(),
  }
})

vi.mock('@/app/components/figma/ReminderSettings', () => ({
  ReminderSettings: () => <div data-testid="reminder-settings" />,
}))

import Settings from '../Settings'

describe('Settings page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><Settings /></MemoryRouter>)
    expect(container).toBeTruthy()
  })

  it('displays the page heading "Settings"', () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders Profile, Appearance, and Data Management sections', () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Data Management')).toBeInTheDocument()
  })

  it('renders the Display Name input with default value', () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)
    const nameInput = screen.getByLabelText('Display Name')
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveValue('Student')
  })
})
