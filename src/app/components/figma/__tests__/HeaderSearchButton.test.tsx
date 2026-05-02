import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeaderSearchButton } from '../HeaderSearchButton'
import { PaletteControllerProvider } from '../PaletteControllerContext'
import { usePaletteController } from '../PaletteControllerContext'
import { renderHook } from '@testing-library/react'

function wrapper(openFn: (scope?: string) => void) {
  return function Provider({ children }: { children: React.ReactNode }) {
    return (
      <PaletteControllerProvider
        value={{ open: openFn as ReturnType<typeof usePaletteController>['open'] }}
      >
        {children}
      </PaletteControllerProvider>
    )
  }
}

describe('HeaderSearchButton', () => {
  it('renders a button with default label derived from scope', () => {
    const open = vi.fn()
    render(
      <PaletteControllerProvider value={{ open }}>
        <HeaderSearchButton scope="course" />
      </PaletteControllerProvider>
    )
    expect(screen.getByRole('button', { name: /search courses/i })).toBeInTheDocument()
  })

  it('renders a button with custom label', () => {
    const open = vi.fn()
    render(
      <PaletteControllerProvider value={{ open }}>
        <HeaderSearchButton scope="author" label="Find an author" />
      </PaletteControllerProvider>
    )
    expect(screen.getByRole('button', { name: /find an author/i })).toBeInTheDocument()
  })

  it('calls open(scope) when clicked', async () => {
    const user = userEvent.setup()
    const open = vi.fn()
    render(
      <PaletteControllerProvider value={{ open }}>
        <HeaderSearchButton scope="book" />
      </PaletteControllerProvider>
    )
    await user.click(screen.getByRole('button'))
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('book')
  })

  it('has the correct testid', () => {
    const open = vi.fn()
    render(
      <PaletteControllerProvider value={{ open }}>
        <HeaderSearchButton scope="lesson" />
      </PaletteControllerProvider>
    )
    expect(screen.getByTestId('header-search-btn-lesson')).toBeInTheDocument()
  })
})

describe('usePaletteController', () => {
  it('throws when called outside of PaletteControllerProvider', () => {
    expect(() => renderHook(() => usePaletteController())).toThrow(
      'usePaletteController must be used inside <PaletteControllerProvider>'
    )
  })

  it('returns context value when inside provider', () => {
    const open = vi.fn()
    const { result } = renderHook(() => usePaletteController(), {
      wrapper: wrapper(open),
    })
    expect(result.current.open).toBe(open)
  })
})
