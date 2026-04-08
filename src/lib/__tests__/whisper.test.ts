import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getWhisperConfig, saveWhisperConfig, getWhisperProvider } from '../whisper/index'
import { WHISPER_DEFAULTS, WHISPER_STORAGE_KEY } from '../whisper/types'

describe('whisper', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('getWhisperConfig', () => {
    it('returns defaults when nothing stored', () => {
      expect(getWhisperConfig()).toEqual(WHISPER_DEFAULTS)
    })

    it('returns stored config merged with defaults', () => {
      localStorage.setItem(WHISPER_STORAGE_KEY, JSON.stringify({ provider: 'groq' }))
      const config = getWhisperConfig()
      expect(config.provider).toBe('groq')
      expect(config.browserModel).toBe('tiny') // from defaults
    })

    it('returns defaults on invalid JSON', () => {
      localStorage.setItem(WHISPER_STORAGE_KEY, 'not-json')
      expect(getWhisperConfig()).toEqual(WHISPER_DEFAULTS)
    })
  })

  describe('saveWhisperConfig', () => {
    it('saves partial config and returns merged result', () => {
      const result = saveWhisperConfig({ provider: 'openai' })
      expect(result.provider).toBe('openai')
      expect(result.browserModel).toBe('tiny')

      const stored = JSON.parse(localStorage.getItem(WHISPER_STORAGE_KEY)!)
      expect(stored.provider).toBe('openai')
    })

    it('dispatches whisper-configuration-updated event', () => {
      const listener = vi.fn()
      window.addEventListener('whisper-configuration-updated', listener)

      saveWhisperConfig({ provider: 'self-hosted' })

      expect(listener).toHaveBeenCalledTimes(1)
      window.removeEventListener('whisper-configuration-updated', listener)
    })

    it('merges with existing config', () => {
      saveWhisperConfig({ provider: 'groq' })
      const result = saveWhisperConfig({ browserModel: 'base' })
      expect(result.provider).toBe('groq')
      expect(result.browserModel).toBe('base')
    })
  })

  describe('getWhisperProvider', () => {
    it('returns browser provider by default', async () => {
      const provider = await getWhisperProvider('browser')
      expect(provider.id).toBe('browser')
    })

    it('returns groq cloud provider', async () => {
      const provider = await getWhisperProvider('groq')
      expect(provider.id).toBe('groq')
    })

    it('returns openai cloud provider', async () => {
      const provider = await getWhisperProvider('openai')
      expect(provider.id).toBe('openai')
    })

    it('returns self-hosted provider', async () => {
      const provider = await getWhisperProvider('self-hosted')
      expect(provider.id).toBe('self-hosted')
    })

    it('throws on unknown provider', async () => {
      await expect(getWhisperProvider('unknown' as never)).rejects.toThrow(
        'Unknown Whisper provider: unknown'
      )
    })

    it('uses config provider when none specified', async () => {
      saveWhisperConfig({ provider: 'groq' })
      const provider = await getWhisperProvider()
      expect(provider.id).toBe('groq')
    })
  })
})
