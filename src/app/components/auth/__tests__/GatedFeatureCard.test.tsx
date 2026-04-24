import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

const mockNavigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import { GatedFeatureCard } from '../GatedFeatureCard'

function renderCard() {
  return render(
    <MemoryRouter>
      <GatedFeatureCard
        title="Integrations"
        description="Sign up to connect AI services and more."
      />
    </MemoryRouter>
  )
}

describe('GatedFeatureCard', () => {
  it('renders lock icon, title, and description', () => {
    renderCard()
    expect(screen.getByTestId('gated-feature-card')).toBeTruthy()
    expect(screen.getByText('Integrations')).toBeTruthy()
    expect(screen.getByText(/Sign up to connect/)).toBeTruthy()
  })

  it('renders Sign up and Sign in buttons', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /sign up to unlock/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in to unlock/i })).toBeTruthy()
  })

  it('Sign up button navigates to /', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole('button', { name: /sign up to unlock/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('Sign in button navigates to /', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole('button', { name: /sign in to unlock/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
