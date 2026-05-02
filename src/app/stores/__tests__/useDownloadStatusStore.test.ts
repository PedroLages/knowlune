/**
 * E97-S04 Unit 1: Tests for useDownloadStatusStore phase transitions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDownloadStatusStore } from '../useDownloadStatusStore'

describe('useDownloadStatusStore', () => {
  beforeEach(() => {
    useDownloadStatusStore.setState({
      status: 'idle',
      lastError: null,
      startedAt: null,
    })
  })

  describe('startHydrating', () => {
    it('transitions idle → hydrating-p3p4 and stamps startedAt', () => {
      const before = Date.now()
      useDownloadStatusStore.getState().startHydrating()
      const state = useDownloadStatusStore.getState()
      expect(state.status).toBe('hydrating-p3p4')
      expect(state.lastError).toBeNull()
      expect(state.startedAt).not.toBeNull()
      expect(state.startedAt!).toBeGreaterThanOrEqual(before)
    })

    it('clears prior lastError when restarting from error', () => {
      useDownloadStatusStore.setState({
        status: 'error',
        lastError: 'boom',
        startedAt: null,
      })
      useDownloadStatusStore.getState().startHydrating()
      const state = useDownloadStatusStore.getState()
      expect(state.status).toBe('hydrating-p3p4')
      expect(state.lastError).toBeNull()
    })
  })

  describe('startDownloadingP0P2', () => {
    it('transitions hydrating-p3p4 → downloading-p0p2', () => {
      useDownloadStatusStore.setState({
        status: 'hydrating-p3p4',
        lastError: null,
        startedAt: 123,
      })
      useDownloadStatusStore.getState().startDownloadingP0P2()
      expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')
    })

    it('is a no-op when called from a non-hydrating phase', () => {
      useDownloadStatusStore.setState({
        status: 'complete',
        lastError: null,
        startedAt: null,
      })
      useDownloadStatusStore.getState().startDownloadingP0P2()
      expect(useDownloadStatusStore.getState().status).toBe('complete')
    })
  })

  describe('completeDownloading', () => {
    it('transitions downloading-p0p2 → complete and clears startedAt', () => {
      useDownloadStatusStore.setState({
        status: 'downloading-p0p2',
        lastError: null,
        startedAt: 123,
      })
      useDownloadStatusStore.getState().completeDownloading()
      const state = useDownloadStatusStore.getState()
      expect(state.status).toBe('complete')
      expect(state.startedAt).toBeNull()
    })

    it('allows fast-path hydrating-p3p4 → complete directly', () => {
      useDownloadStatusStore.setState({
        status: 'hydrating-p3p4',
        lastError: null,
        startedAt: 123,
      })
      useDownloadStatusStore.getState().completeDownloading()
      expect(useDownloadStatusStore.getState().status).toBe('complete')
    })
  })

  describe('failDownloading', () => {
    it('transitions hydrating-p3p4 → error with message', () => {
      useDownloadStatusStore.setState({
        status: 'hydrating-p3p4',
        lastError: null,
        startedAt: 1,
      })
      useDownloadStatusStore.getState().failDownloading('boom')
      const state = useDownloadStatusStore.getState()
      expect(state.status).toBe('error')
      expect(state.lastError).toBe('boom')
    })

    it('transitions downloading-p0p2 → error', () => {
      useDownloadStatusStore.setState({
        status: 'downloading-p0p2',
        lastError: null,
        startedAt: 1,
      })
      useDownloadStatusStore.getState().failDownloading('engine died')
      expect(useDownloadStatusStore.getState().status).toBe('error')
      expect(useDownloadStatusStore.getState().lastError).toBe('engine died')
    })

    it('falls back to default message when called with empty string', () => {
      useDownloadStatusStore.getState().failDownloading('')
      expect(useDownloadStatusStore.getState().lastError).toBe('Download failed')
    })
  })

  describe('reset', () => {
    it('returns any phase to idle with cleared error and startedAt', () => {
      useDownloadStatusStore.setState({
        status: 'error',
        lastError: 'boom',
        startedAt: 999,
      })
      useDownloadStatusStore.getState().reset()
      const state = useDownloadStatusStore.getState()
      expect(state.status).toBe('idle')
      expect(state.lastError).toBeNull()
      expect(state.startedAt).toBeNull()
    })
  })
})
