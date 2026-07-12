/**
 * Stale-chunk recovery — intercepts vite:preloadError events and recovers
 * from missing/poisoned dynamically imported chunks after a deployment.
 *
 * Recovery strategy (two tiers):
 *
 * Tier 1 — First failure: Purge the poisoned entry from all SW caches, send
 *   PURGE_INVALID_ASSET_CACHE to the SW, call registration.update(), then
 *   reload with a cache-busting query param.
 *
 * Tier 2 — Second failure (same poisoned entry after reload): Show a dedicated
 *   "Knowlune was updated" recovery screen with a "Reload Cleanly" button
 *   that nukes the entire route-chunks cache and reloads. Do NOT render the
 *   generic RouteErrorBoundary for this specific failure mode.
 *
 * Must run BEFORE React.render() — React.lazy() calls happen during render.
 *
 * @module chunkRecovery
 */

export const CHUNK_RECOVERY_KEY = 'knowlune-chunk-recovery'
export const RECOVERY_SCREEN_KEY = 'knowlune-recovery-screen'

/** HTML for the "Knowlune was updated" recovery screen shown on second failure. */
function showRecoveryScreen(failedUrl: string, buildVersion: string, swVersion: string) {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div style="
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      background: #FAF5EE;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="
        max-width: 420px;
        width: 100%;
        background: white;
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
        <h2 style="font-size: 20px; font-weight: 600; color: #1c1917; margin: 0 0 8px;">
          Knowlune was updated
        </h2>
        <p style="font-size: 14px; color: #78716c; line-height: 1.6; margin: 0 0 24px;">
          A new version was just deployed. Some assets are still cached and need a clean reload.
        </p>
        <button id="recovery-reload-btn" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          background: #5e6ad2;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">
          Reload Cleanly
        </button>
        <p style="font-size: 11px; color: #a8a29e; margin: 16px 0 0;">
          Build: ${buildVersion || 'unknown'} &middot; SW: ${swVersion || 'unknown'}
          ${failedUrl ? `<br>Failed: ${failedUrl}` : ''}
        </p>
      </div>
    </div>
  `

  document.getElementById('recovery-reload-btn')?.addEventListener('click', async () => {
    // Nuke all route-chunks caches before reloading
    try {
      const cacheNames = await caches.keys()
      const toDelete = cacheNames.filter(
        n => n.includes('route-chunks') || n.includes('knowlune-chunk')
      )
      await Promise.all(toDelete.map(n => caches.delete(n)))
      console.log('[ChunkRecovery] Deleted caches:', toDelete)
    } catch {
      // Best-effort
    }
    sessionStorage.removeItem(CHUNK_RECOVERY_KEY)
    sessionStorage.removeItem(RECOVERY_SCREEN_KEY)
    window.location.reload()
  })
}

/** Extract the failed asset URL from a vite:preloadError event payload. */
function extractFailedUrl(event: Event): string {
  try {
    const detail = (event as CustomEvent)?.detail
    const payload = detail?.payload
    const errorMessage =
      payload?.message ||
      payload?.toString() ||
      ''
    const urlMatch = errorMessage.match(/https?:\/\/[^\s]+\.(?:js|css|woff2?)/i)
    if (urlMatch) return urlMatch[0]
    if (typeof payload === 'string' && payload.startsWith('http')) return payload
  } catch {
    // Ignore extraction failures
  }
  return ''
}

/**
 * Register the vite:preloadError listener.
 * Must be called BEFORE React renders, since React.lazy() calls happen during render.
 */
export function initChunkRecovery(): void {
  window.addEventListener('vite:preloadError', async (event) => {
    event.preventDefault()

    const isSecondAttempt = !!sessionStorage.getItem(CHUNK_RECOVERY_KEY)
    const failedUrl = extractFailedUrl(event)

    // ─── Tier 2: Second failure — show recovery screen ────────────────────
    if (isSecondAttempt) {
      console.error(
        '[ChunkRecovery] Reload already attempted — chunk still missing:',
        failedUrl || event
      )

      let swVersion = 'unknown'
      try {
        const reg = await navigator.serviceWorker?.getRegistration()
        const sw = reg?.active || reg?.waiting || reg?.installing
        if (sw) {
          swVersion = sw.scriptURL
        }
      } catch {
        // Best-effort
      }

      const buildVersion =
        (window as any).__KNOWLUNE_BUILD_VERSION__ ||
        document.querySelector('meta[name="build-version"]')?.getAttribute('content') ||
        'unknown'

      sessionStorage.setItem(RECOVERY_SCREEN_KEY, '1')
      showRecoveryScreen(failedUrl, buildVersion, swVersion)
      return
    }

    // ─── Tier 1: First failure — purge caches and reload ──────────────────
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')

    console.warn(
      '[ChunkRecovery] Stale chunk detected, purging caches and reloading...',
      failedUrl || event
    )

    try {
      // Step 1: Delete the specific failed entry from all Knowlune caches
      if (failedUrl) {
        const cacheNames = await caches.keys()
        for (const cacheName of cacheNames) {
          try {
            const cache = await caches.open(cacheName)
            await cache.delete(new Request(failedUrl))
            await cache.delete(failedUrl)
          } catch {
            // Best-effort per-cache
          }
        }
      }

      // Step 2: Send PURGE_INVALID_ASSET_CACHE to the active service worker
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg?.active) {
        reg.active.postMessage({ type: 'PURGE_INVALID_ASSET_CACHE' })
      }

      // Step 3: Force a SW update check
      if (reg) {
        try {
          await reg.update()
        } catch {
          // Best-effort
        }
      }

      // Step 4: Reload with cache-busting query
      const url = new URL(window.location.href)
      url.searchParams.set('__reload', Date.now().toString())
      window.location.replace(url.toString())
    } catch {
      // Fallback: simple reload if cache APIs fail
      const url = new URL(window.location.href)
      url.searchParams.set('__reload', Date.now().toString())
      window.location.replace(url.toString())
    }
  })

  // Clear the recovery screen key on successful load — the app loaded,
  // recovery screen shouldn't persist across sessions.
  window.addEventListener('load', () => {
    sessionStorage.removeItem(RECOVERY_SCREEN_KEY)
  })
}

/**
 * Clear the chunk recovery marker after the app has rendered successfully.
 * Call this from a useEffect after React mount + enough time for lazy routes
 * to load.
 */
export function clearRecoveryMarker(): void {
  sessionStorage.removeItem(CHUNK_RECOVERY_KEY)
  sessionStorage.removeItem(RECOVERY_SCREEN_KEY)
}
