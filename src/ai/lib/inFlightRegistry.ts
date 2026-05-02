/**
 * In-Flight AI Request Registry — E119-S08
 *
 * Module-level registry that tracks active AbortControllers for AI requests.
 * This allows the consent withdrawal effect (ai_tutor) to cancel all pending
 * AI requests without coupling to React component state.
 *
 * Usage in AI hooks:
 *   const controller = new AbortController()
 *   registerAIRequest(controller)
 *   try {
 *     await doAIRequest(controller.signal)
 *   } finally {
 *     unregisterAIRequest(controller)
 *   }
 *
 * Consent withdrawal:
 *   abortAllInFlightAIRequests()  // aborts all registered controllers
 *
 * Note: abort() on an already-aborted controller is a no-op per the spec.
 */

const _registry = new Set<AbortController>()

/**
 * Register an AbortController for an in-flight AI request.
 * Call immediately after creating the controller.
 */
export function registerAIRequest(controller: AbortController): void {
  _registry.add(controller)
}

/**
 * Unregister an AbortController when the request completes or is cleaned up.
 * Call in the finally block of any async AI request.
 */
export function unregisterAIRequest(controller: AbortController): void {
  _registry.delete(controller)
}

/**
 * Abort all currently registered AI requests and clear the registry.
 * Called by the ai_tutor consent withdrawal effect.
 */
export function abortAllInFlightAIRequests(): void {
  for (const controller of _registry) {
    controller.abort()
  }
  _registry.clear()
}

/**
 * Exported for testing only. Returns the current registry size.
 */
export function _registrySize(): number {
  return _registry.size
}
