import { describe, it, expect, vi, afterEach } from 'vitest'
import { mapLLMError } from '@/ai/lib/llmErrorMapper'
import { LLMError } from '@/ai/llm/types'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mapLLMError', () => {
  it('returns expected user message for known error code', () => {
    const err = new LLMError('TIMEOUT', 'Request timed out after 30s')
    const result = mapLLMError(err)
    expect(result).toBe('Request timed out. Please try again.')
  })

  it('returns generic safe message for unknown error code — does not expose raw error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new LLMError('UNKNOWN_CODE' as never, 'internal debug details')
    const result = mapLLMError(err)
    expect(result).toBe('Something went wrong. Please try again.')
    expect(result).not.toContain('internal debug details')
    expect(consoleSpy).toHaveBeenCalledWith('[LLM] Unrecognized error:', err)
  })
})
