/**
 * Tests for YouTubeUnembeddableFallback — reason-aware fallback UI for
 * non-embeddable YouTube videos.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  YouTubeUnembeddableFallback,
  getUnembeddableCopy,
} from '@/app/components/youtube/YouTubeUnembeddableFallback'
import type { UnembeddableReason } from '@/data/types'

describe('getUnembeddableCopy', () => {
  const cases: Array<{ reason: UnembeddableReason | undefined; title: string; body: string }> = [
    {
      reason: 'embedding-disabled',
      title: "Can't play here",
      body: 'The video owner has disabled embedding on other sites.',
    },
    {
      reason: 'private',
      title: 'Video is private',
      body: "This video is private and can't be played here.",
    },
    {
      reason: 'deleted',
      title: 'Video unavailable',
      body: 'This video is no longer available on YouTube.',
    },
    {
      reason: 'deleted-or-private',
      title: 'Video unavailable',
      body: 'This video is no longer available on YouTube or has been made private.',
    },
    {
      reason: 'region-restricted',
      title: 'May not be available in your region',
      body: 'The video owner has restricted this video in some regions.',
    },
    {
      reason: 'unknown',
      title: "Video couldn't load",
      body: 'The YouTube player failed to initialize. This may be caused by a browser extension or network setting.',
    },
    {
      reason: undefined,
      title: "Video couldn't load",
      body: 'The YouTube player failed to initialize. This may be caused by a browser extension or network setting.',
    },
  ]

  it.each(cases)('returns matching copy for reason=$reason', ({ reason, title, body }) => {
    const copy = getUnembeddableCopy(reason)
    expect(copy.title).toBe(title)
    expect(copy.body).toBe(body)
  })
})

describe('YouTubeUnembeddableFallback', () => {
  it('renders the fallback container with the shared testid', () => {
    render(<YouTubeUnembeddableFallback videoId="abc123" reason="embedding-disabled" />)
    expect(screen.getByTestId('youtube-player-fallback')).toBeInTheDocument()
  })

  it('renders reason-specific copy for embedding-disabled', () => {
    render(<YouTubeUnembeddableFallback videoId="abc123" reason="embedding-disabled" />)
    expect(screen.getByText("Can't play here")).toBeInTheDocument()
    expect(
      screen.getByText('The video owner has disabled embedding on other sites.')
    ).toBeInTheDocument()
  })

  it('renders generic copy when reason is undefined', () => {
    render(<YouTubeUnembeddableFallback videoId="abc123" />)
    expect(screen.getByText("Video couldn't load")).toBeInTheDocument()
  })

  it('renders Watch on YouTube link with correct href and safe rel attrs', () => {
    render(<YouTubeUnembeddableFallback videoId="abc123" reason="private" />)
    const link = screen.getByRole('link', { name: /watch on youtube/i })
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
