import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatModelSize,
  getOllamaSelectedModel,
  getAIConfiguration,
  saveAIConfiguration,
} from '../aiConfiguration'

describe('formatModelSize', () => {
  it('formats bytes', () => {
    expect(formatModelSize(0)).toBe('0 B')
    expect(formatModelSize(512)).toBe('512.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatModelSize(1024)).toBe('1.0 KB')
    expect(formatModelSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatModelSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatModelSize(500 * 1024 * 1024)).toBe('500.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatModelSize(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatModelSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
  })
})

describe('getOllamaSelectedModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when provider is not ollama', () => {
    expect(getOllamaSelectedModel()).toBeNull()
  })

  it('returns null when no model is selected', async () => {
    await saveAIConfiguration({
      provider: 'ollama',
      ollamaSettings: {
        serverUrl: 'http://192.168.2.200:11434',
        directConnection: false,
      },
    })
    expect(getOllamaSelectedModel()).toBeNull()
  })

  it('returns selected model name', async () => {
    await saveAIConfiguration({
      provider: 'ollama',
      ollamaSettings: {
        serverUrl: 'http://192.168.2.200:11434',
        directConnection: false,
        selectedModel: 'llama3.2:latest',
      },
    })
    expect(getOllamaSelectedModel()).toBe('llama3.2:latest')
  })
})

describe('OllamaSettings persistence (AC3)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists selectedModel in AI configuration', async () => {
    await saveAIConfiguration({
      provider: 'ollama',
      ollamaSettings: {
        serverUrl: 'http://192.168.2.200:11434',
        directConnection: false,
        selectedModel: 'phi3:mini',
      },
    })

    const config = getAIConfiguration()
    expect(config.ollamaSettings?.selectedModel).toBe('phi3:mini')
  })

  it('preserves selectedModel when updating other ollama settings', async () => {
    await saveAIConfiguration({
      provider: 'ollama',
      ollamaSettings: {
        serverUrl: 'http://192.168.2.200:11434',
        directConnection: false,
        selectedModel: 'llama3.2:latest',
      },
    })

    // Update directConnection without losing selectedModel
    await saveAIConfiguration({
      ollamaSettings: {
        serverUrl: 'http://192.168.2.200:11434',
        directConnection: true,
        selectedModel: 'llama3.2:latest',
      },
    })

    const config = getAIConfiguration()
    expect(config.ollamaSettings?.selectedModel).toBe('llama3.2:latest')
    expect(config.ollamaSettings?.directConnection).toBe(true)
  })
})
