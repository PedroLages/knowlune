import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock dependencies before importing the component
const mockGetAIConfiguration = vi.fn()
const mockSaveAIConfiguration = vi.fn().mockResolvedValue(undefined)
const mockTestAIConnection = vi.fn().mockResolvedValue(false)

vi.mock('@/lib/aiConfiguration', () => ({
  getAIConfiguration: () => mockGetAIConfiguration(),
  saveAIConfiguration: (...args: unknown[]) => mockSaveAIConfiguration(...args),
  testAIConnection: (...args: unknown[]) => mockTestAIConnection(...args),
  getConfiguredProviderIds: () => [],
  getDecryptedApiKeyForProvider: vi.fn().mockResolvedValue(null),
  saveProviderApiKey: vi.fn().mockResolvedValue(undefined),
  deleteProviderApiKey: vi.fn().mockResolvedValue(undefined),
  AI_PROVIDERS: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      validateApiKey: (key: string) => key.startsWith('sk-'),
      testConnection: async () => true,
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic',
      validateApiKey: (key: string) => key.startsWith('sk-ant-'),
      testConnection: async () => true,
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama (Local)',
      usesServerUrl: true,
      validateApiKey: (url: string) => {
        try {
          const parsed = new URL(url)
          return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        } catch {
          return false
        }
      },
      testConnection: async () => true,
    },
  },
}))

vi.mock('@/lib/ollamaHealthCheck', () => ({
  testOllamaConnection: vi.fn().mockResolvedValue({ success: true, message: 'OK' }),
}))

vi.mock('./OllamaModelPicker', () => ({
  OllamaModelPicker: () => <div data-testid="ollama-model-picker">Model Picker</div>,
}))

// Relative import path from __tests__ directory
import { AIConfigurationSettings } from '../AIConfigurationSettings'

const DEFAULT_CONFIG = {
  provider: 'openai' as const,
  connectionStatus: 'unconfigured' as const,
  consentSettings: {
    videoSummary: true,
    noteQA: true,
    learningPath: true,
    knowledgeGaps: true,
    noteOrganization: true,
    analytics: true,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAIConfiguration.mockReturnValue({ ...DEFAULT_CONFIG })
})

describe('AIConfigurationSettings', () => {
  describe('E22-S01 AC1: Ollama appears in provider dropdown', () => {
    it('renders the AI provider selector with current provider displayed', () => {
      render(<AIConfigurationSettings />)

      const trigger = screen.getByTestId('ai-provider-selector')
      expect(trigger).toBeInTheDocument()
      // Default provider is OpenAI
      expect(trigger).toHaveTextContent('OpenAI')
    })

    it('displays "Ollama (Local)" when Ollama is the selected provider', () => {
      mockGetAIConfiguration.mockReturnValue({
        ...DEFAULT_CONFIG,
        provider: 'ollama',
        ollamaSettings: { serverUrl: '', directConnection: false },
      })

      render(<AIConfigurationSettings />)

      const trigger = screen.getByTestId('ai-provider-selector')
      expect(trigger).toHaveTextContent('Ollama (Local)')
    })

    it('renders Ollama-specific UI elements when Ollama is selected', () => {
      mockGetAIConfiguration.mockReturnValue({
        ...DEFAULT_CONFIG,
        provider: 'ollama',
        ollamaSettings: { serverUrl: '', directConnection: false },
      })

      render(<AIConfigurationSettings />)

      // When Ollama is selected, we get Ollama-specific UI (URL input, advanced toggle)
      expect(screen.getByTestId('ollama-url-input')).toBeInTheDocument()
      expect(screen.getByText('Server URL')).toBeInTheDocument()
    })
  })

  describe('E22-S01 AC2: URL input (not API key) when Ollama selected', () => {
    it('shows URL input with correct placeholder when Ollama is the provider', () => {
      mockGetAIConfiguration.mockReturnValue({
        ...DEFAULT_CONFIG,
        provider: 'ollama',
        ollamaSettings: { serverUrl: '', directConnection: false },
      })

      render(<AIConfigurationSettings />)

      const urlInput = screen.getByTestId('ollama-url-input')
      expect(urlInput).toBeInTheDocument()
      expect(urlInput).toHaveAttribute('placeholder', 'http://192.168.1.x:11434')
      expect(urlInput).toHaveAttribute('type', 'url')
    })

    it('does NOT show API key input when Ollama is selected', () => {
      mockGetAIConfiguration.mockReturnValue({
        ...DEFAULT_CONFIG,
        provider: 'ollama',
        ollamaSettings: { serverUrl: '', directConnection: false },
      })

      render(<AIConfigurationSettings />)

      expect(screen.queryByTestId('api-key-input')).not.toBeInTheDocument()
    })

    it('shows provider key accordion when a non-Ollama provider is selected', () => {
      render(<AIConfigurationSettings />)

      expect(screen.getByTestId('provider-key-accordion')).toBeInTheDocument()
      expect(screen.queryByTestId('ollama-url-input')).not.toBeInTheDocument()
    })

    it('shows Server URL label when Ollama is selected', () => {
      mockGetAIConfiguration.mockReturnValue({
        ...DEFAULT_CONFIG,
        provider: 'ollama',
        ollamaSettings: { serverUrl: '', directConnection: false },
      })

      render(<AIConfigurationSettings />)

      expect(screen.getByText('Server URL')).toBeInTheDocument()
    })
  })
})
