/**
 * useMediaSession — sets up the Media Session API for OS-level playback control.
 *
 * Sets metadata (title, artist, album, artwork) and registers action handlers
 * (play, pause, previoustrack, nexttrack, seekbackward, seekforward).
 * Guards on `'mediaSession' in navigator` for browser compatibility.
 *
 * @module useMediaSession
 * @since E87-S05
 */
import { useEffect } from 'react'

interface UseMediaSessionOptions {
  title: string
  artist: string
  album: string
  artworkUrl?: string
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onPrevTrack: () => void
  onNextTrack: () => void
}

export function useMediaSession({
  title,
  artist,
  album,
  artworkUrl,
  isPlaying,
  onPlay,
  onPause,
  onSkipBack,
  onSkipForward,
  onPrevTrack,
  onNextTrack,
}: UseMediaSessionOptions) {
  // Set metadata when chapter or book changes
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const artwork = artworkUrl ? [{ src: artworkUrl, sizes: '256x256', type: 'image/jpeg' }] : []

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork,
    })
  }, [title, artist, album, artworkUrl])

  // Register action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.setActionHandler('play', onPlay)
    navigator.mediaSession.setActionHandler('pause', onPause)
    navigator.mediaSession.setActionHandler('seekbackward', () => onSkipBack())
    navigator.mediaSession.setActionHandler('seekforward', () => onSkipForward())
    navigator.mediaSession.setActionHandler('previoustrack', onPrevTrack)
    navigator.mediaSession.setActionHandler('nexttrack', onNextTrack)

    return () => {
      if (!('mediaSession' in navigator)) return
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('seekbackward', null)
      navigator.mediaSession.setActionHandler('seekforward', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
  }, [onPlay, onPause, onSkipBack, onSkipForward, onPrevTrack, onNextTrack])

  // Sync playback state with OS
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])
}
