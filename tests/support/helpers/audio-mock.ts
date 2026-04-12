import type { Page } from '@playwright/test'

/**
 * Mock HTMLMediaElement for E2E tests that involve audiobook playback.
 *
 * Stubs play(), load(), readyState, src, and currentTime so tests can
 * exercise player UI without real audio files. Tests can control
 * currentTime via `window.__mockCurrentTime__`.
 *
 * @since E111-S03 — extracted from story-e111-s01.spec.ts
 */
export async function mockAudioElement(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function () {
        return Promise.resolve()
      },
    })

    const originalLoad = HTMLMediaElement.prototype.load
    HTMLMediaElement.prototype.load = function () {
      originalLoad.call(this)
      Promise.resolve().then(() => {
        this.dispatchEvent(new Event('canplay'))
      })
    }

    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc ? 4 : 0
      },
    })

    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc ?? ''
      },
      set(value: string) {
        ;(this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc = value
        if (srcDescriptor?.set) srcDescriptor.set.call(this, value)
      },
    })

    // Expose test-controlled currentTime — tests can set window.__mockCurrentTime__
    // to control what the player sees.
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() {
        const win = window as Window & { __mockCurrentTime__?: number }
        return win.__mockCurrentTime__ ?? 0
      },
      set(value: number) {
        const win = window as Window & { __mockCurrentTime__?: number }
        win.__mockCurrentTime__ = value
      },
    })
  })
}
