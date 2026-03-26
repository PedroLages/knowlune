/**
 * Ollama Connection Testing & Health Check
 *
 * Provides connection testing with actionable error messages for common failure modes:
 * - Server unreachable (wrong URL, server down)
 * - CORS blocked (direct mode without OLLAMA_ORIGINS)
 * - Model not found (model not pulled)
 *
 * Also provides startup health check that runs when Ollama is configured.
 *
 * @see E22-S03 Connection Testing & Health Check
 */

import { getAIConfiguration, saveAIConfiguration, getOllamaSelectedModel } from './aiConfiguration'

/** Result of a connection test */
export interface ConnectionTestResult {
  /** Whether the connection succeeded */
  success: boolean
  /** Human-readable status message */
  message: string
  /** Error category for UI handling */
  errorType?: 'unreachable' | 'cors' | 'model-not-found' | 'unknown'
}

/** Timeout for health check requests (shorter than full request timeout) */
const HEALTH_CHECK_TIMEOUT = 5_000 // 5 seconds

/**
 * Tests connectivity to an Ollama server with actionable error messages.
 *
 * Performs a lightweight GET to the Ollama root endpoint (returns "Ollama is running")
 * then optionally verifies the selected model is available via /api/tags.
 *
 * @param serverUrl - Ollama server URL (e.g., "http://192.168.2.200:11434")
 * @param directConnection - Whether to connect directly (vs. through proxy)
 * @param selectedModel - Optional model name to verify availability
 * @returns Connection test result with actionable error messages
 */
export async function testOllamaConnection(
  serverUrl: string,
  directConnection: boolean,
  selectedModel?: string
): Promise<ConnectionTestResult> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')

  // Step 1: Ping the server root endpoint
  try {
    const pingUrl = directConnection
      ? normalizedUrl
      : `/api/ai/ollama/health?serverUrl=${encodeURIComponent(normalizedUrl)}`

    const response = await fetch(pingUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    })

    if (!response.ok) {
      return {
        success: false,
        message: `Ollama returned HTTP ${response.status}. Check server configuration.`,
        errorType: 'unknown',
      }
    }

    // Ollama root returns "Ollama is running" as plain text
    const body = await response.text()
    if (directConnection && !body.includes('Ollama')) {
      return {
        success: false,
        message: `Server at ${normalizedUrl} does not appear to be Ollama. Got unexpected response.`,
        errorType: 'unknown',
      }
    }
  } catch (error) {
    return classifyConnectionError(error, normalizedUrl, directConnection)
  }

  // Step 2: Verify selected model is available (if specified)
  if (selectedModel) {
    try {
      const tagsUrl = directConnection
        ? `${normalizedUrl}/api/tags`
        : `/api/ai/ollama/tags?serverUrl=${encodeURIComponent(normalizedUrl)}`

      const tagsResponse = await fetch(tagsUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
      })

      if (tagsResponse.ok) {
        const data = (await tagsResponse.json()) as {
          models?: Array<{ name: string }>
        }

        const modelNames = data.models?.map(m => m.name) ?? []
        if (modelNames.length > 0 && !modelNames.includes(selectedModel)) {
          return {
            success: false,
            message: `Model "${selectedModel}" not available. Pull it with \`ollama pull ${selectedModel}\``,
            errorType: 'model-not-found',
          }
        }
      }
    } catch {
      // Model check is best-effort; server ping succeeded so connection is OK
    }
  }

  return {
    success: true,
    message: 'Connected to Ollama',
  }
}

/**
 * Classifies a connection error into an actionable error message.
 *
 * Distinguishes between:
 * - Network errors (server unreachable)
 * - CORS errors (direct mode without OLLAMA_ORIGINS)
 * - Timeout errors
 */
function classifyConnectionError(
  error: unknown,
  serverUrl: string,
  directConnection: boolean
): ConnectionTestResult {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''

  // Timeout
  if (name === 'AbortError' || name === 'TimeoutError' || message.includes('timeout')) {
    return {
      success: false,
      message: `Cannot reach Ollama at ${serverUrl}. Is the server running?`,
      errorType: 'unreachable',
    }
  }

  // CORS error in direct mode — TypeError with "Failed to fetch" is the typical symptom
  if (
    directConnection &&
    (message.includes('Failed to fetch') || message.includes('NetworkError'))
  ) {
    return {
      success: false,
      message: `CORS blocked. Set OLLAMA_ORIGINS=* on your Ollama server or use proxy mode.`,
      errorType: 'cors',
    }
  }

  // Generic network error (proxy mode or non-CORS failure)
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return {
      success: false,
      message: `Cannot reach Ollama at ${serverUrl}. Is the server running?`,
      errorType: 'unreachable',
    }
  }

  return {
    success: false,
    message: `Connection failed: ${message}`,
    errorType: 'unknown',
  }
}

/**
 * Runs a startup health check if Ollama is configured.
 *
 * Called during app initialization (deferred after first paint).
 * Updates the connection status in localStorage so the UI reflects
 * the current state without requiring manual "Test Connection".
 *
 * AC4: Health check runs on app startup if Ollama is configured.
 */
export async function runStartupHealthCheck(): Promise<void> {
  const config = getAIConfiguration()

  // Only run for Ollama provider with a configured server URL
  if (config.provider !== 'ollama') return
  if (!config.ollamaSettings?.serverUrl) return

  const selectedModel = getOllamaSelectedModel()

  try {
    const result = await testOllamaConnection(
      config.ollamaSettings.serverUrl,
      config.ollamaSettings.directConnection,
      selectedModel ?? undefined
    )

    if (result.success) {
      await saveAIConfiguration({
        connectionStatus: 'connected',
        errorMessage: undefined,
      })
    } else {
      await saveAIConfiguration({
        connectionStatus: 'error',
        errorMessage: result.message,
      })
    }
  } catch {
    // Startup health check is best-effort; don't crash the app
    await saveAIConfiguration({
      connectionStatus: 'error',
      errorMessage: 'Health check failed. Check your Ollama server.',
    })
  }
}
