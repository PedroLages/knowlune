/**
 * Safe fullscreen exit utility.
 *
 * Exits fullscreen only when an element is currently fullscreen, and silently
 * catches any DOM exceptions (e.g., if the request is denied or the document
 * is not fullscreen). This avoids throwing on redundant exit calls.
 */

/**
 * Exit fullscreen if the document is currently in fullscreen mode.
 * Silently catches any errors (e.g., if the document is not fullscreen
 * or the request is denied by browser policy).
 */
export function exitFullscreenIfActive(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // silent-catch-ok: best-effort fullscreen exit
    })
  }
}
