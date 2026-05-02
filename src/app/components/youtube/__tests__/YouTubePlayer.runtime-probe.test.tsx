/**
 * Runtime embeddability probe tests for YouTubePlayer — Unit 5 backfill.
 *
 * Verifies that for legacy imports (where `lessonEmbeddableState` is
 * undefined), the player runs a delayed oEmbed probe after iframe onLoad and:
 *   - flips to the fallback when the probe returns a definite non-embeddable signal
 *   - notifies the parent so it can persist the flag to Dexie
 *   - does nothing when the probe returns `embeddable: true`
 *   - does nothing for `reason: 'unknown'` (transient network failures)
 *   - skips the probe entirely when `lessonEmbeddableState === true`
 *   - does not re-fire on re-render (probedRef dedupe)
 *   - does not set state after unmount
 *
 * @see docs/plans/2026-04-24-004-fix-youtube-embed-blocked-fallback-plan.md
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup, waitFor } from '@testing-library/react'
import Dexie from 'dexie'

vi.mock('@/lib/youtubeEmbeddability', () => ({
  probeEmbeddability: vi.fn(),
}))

import { YouTubePlayer } from '@/app/components/youtube/YouTubePlayer'
import { probeEmbeddability } from '@/lib/youtubeEmbeddability'

const probeMock = probeEmbeddability as unknown as ReturnType<typeof vi.fn>

async function waitForIframe(): Promise<HTMLIFrameElement> {
  return waitFor(() => {
    const iframe = document.querySelector('iframe')
    if (!iframe) throw new Error('iframe not yet rendered')
    return iframe as HTMLIFrameElement
  })
}

async function fireIframeLoad() {
  const iframe = await waitForIframe()
  await act(async () => {
    iframe.dispatchEvent(new Event('load'))
  })
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  probeMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('YouTubePlayer runtime embeddability probe', () => {
  it('skips the probe when lessonEmbeddableState === true', async () => {
    probeMock.mockResolvedValue({ embeddable: true })

    render(
      <YouTubePlayer
        videoId="vid-known-good"
        courseId="course-1"
        lessonId="lesson-1"
        lessonEmbeddableState={true}
      />
    )

    await fireIframeLoad()
    // Wait past the 500ms probe delay.
    await new Promise(r => setTimeout(r, 700))

    expect(probeMock).not.toHaveBeenCalled()
  })

  it('runs the probe for legacy imports and keeps iframe when probe says embeddable', async () => {
    probeMock.mockResolvedValue({ embeddable: true })

    render(
      <YouTubePlayer videoId="vid-legacy-ok" courseId="course-1" lessonId="lesson-2" />
    )

    await fireIframeLoad()
    await waitFor(() => expect(probeMock).toHaveBeenCalledWith('vid-legacy-ok'))

    // Iframe still in DOM, fallback NOT rendered.
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.queryByTestId('youtube-player-fallback')).toBeNull()
  })

  it('flips to fallback and calls onUnembeddableDetected when probe returns embedding-disabled', async () => {
    probeMock.mockResolvedValue({ embeddable: false, reason: 'embedding-disabled' })
    const onUnembeddable = vi.fn()

    render(
      <YouTubePlayer
        videoId="vid-blocked"
        courseId="course-1"
        lessonId="lesson-3"
        onUnembeddableDetected={onUnembeddable}
      />
    )

    await fireIframeLoad()
    await waitFor(() =>
      expect(onUnembeddable).toHaveBeenCalledWith('embedding-disabled')
    )

    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByTestId('youtube-player-fallback')).toBeInTheDocument()
  })

  it('does not act on reason: "unknown" (transient failures)', async () => {
    probeMock.mockResolvedValue({ embeddable: false, reason: 'unknown' })
    const onUnembeddable = vi.fn()

    render(
      <YouTubePlayer
        videoId="vid-transient"
        courseId="course-1"
        lessonId="lesson-4"
        onUnembeddableDetected={onUnembeddable}
      />
    )

    await fireIframeLoad()
    await waitFor(() => expect(probeMock).toHaveBeenCalledTimes(1))
    // Give the promise chain a chance to run to completion.
    await new Promise(r => setTimeout(r, 50))

    expect(onUnembeddable).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeTruthy()
  })

  it('does not update state when unmounted before probe resolves', async () => {
    let resolveProbe: (v: { embeddable: false; reason: 'embedding-disabled' }) => void = () => {}
    probeMock.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveProbe = resolve
        })
    )
    const onUnembeddable = vi.fn()

    const { unmount } = render(
      <YouTubePlayer
        videoId="vid-unmount"
        courseId="course-1"
        lessonId="lesson-5"
        onUnembeddableDetected={onUnembeddable}
      />
    )

    await fireIframeLoad()
    // Wait for the 500ms delay so probe gets invoked, but it never resolves.
    await waitFor(() => expect(probeMock).toHaveBeenCalledTimes(1))

    unmount()
    // Now resolve the probe — ignore guard should prevent any callback.
    await act(async () => {
      resolveProbe({ embeddable: false, reason: 'embedding-disabled' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onUnembeddable).not.toHaveBeenCalled()
  })

  it('does not re-run the probe on prop-triggered re-render (probedRef dedupe)', async () => {
    probeMock.mockResolvedValue({ embeddable: true })

    const { rerender } = render(
      <YouTubePlayer videoId="vid-dedupe" courseId="course-1" lessonId="lesson-6" />
    )

    await fireIframeLoad()
    await waitFor(() => expect(probeMock).toHaveBeenCalledTimes(1))

    // Re-render with the same props — probedRef guard should prevent another call.
    rerender(
      <YouTubePlayer videoId="vid-dedupe" courseId="course-1" lessonId="lesson-6" />
    )
    await new Promise(r => setTimeout(r, 700))

    expect(probeMock).toHaveBeenCalledTimes(1)
  })
})
