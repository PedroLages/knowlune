/**
 * Sync Engine — E92-S04 stub
 *
 * This module exposes the public API surface that `syncableWrite()` (and later
 * the upload/download loop) depend on. In S04 the implementation is intentionally
 * empty — real logic lands in E92-S05 (upload phase) and E92-S06 (download phase).
 *
 * **API contract (must not change in E92-S05):**
 *   - `syncEngine.nudge(): void` — debounced upload trigger (no-op here)
 *   - `syncEngine.isRunning: boolean` — true when the engine is actively syncing
 *
 * **Internal API (may be replaced in E92-S05):**
 *   - `syncEngine._setRunning(value: boolean): void` — used by engine start/stop
 *
 * Pure module — no Dexie, Zustand, or React imports. Safe to import anywhere.
 */

let _isRunning = false

export const syncEngine = {
  /**
   * Signal the engine to run an upload cycle soon.
   * In E92-S05 this becomes a debounced (200ms) upload trigger.
   * In S04 this is a no-op — the stub must exist so `syncableWrite` compiles.
   */
  nudge(): void {
    // Intentional no-op: upload trigger implemented in E92-S05.
  },

  /** True when the engine is actively processing the sync queue. */
  get isRunning(): boolean {
    return _isRunning
  },

  /**
   * @internal — used by `syncEngine.start()` / `syncEngine.stop()` in E92-S05.
   * Do not call from application code.
   */
  _setRunning(value: boolean): void {
    _isRunning = value
  },
}
