/**
 * Device Identity — E92-S04
 *
 * Generates and persists a stable device identifier for the sync pipeline.
 * The deviceId is stored in localStorage so it survives page refreshes and
 * app restarts but resets on storage clear or a new browser profile.
 *
 * Usage by the sync engine (E92-S05 and later):
 *   The deviceId is included in queue metadata when records are uploaded to
 *   Supabase, allowing the server to attribute writes to a specific device.
 *   It is NOT stamped on individual Dexie records in S04 — that is deferred
 *   to E92-S05 when the upload engine is wired.
 *
 * Pure module — no Dexie, Zustand, or React imports. Safe to import anywhere.
 */

/** localStorage key for the persisted device identifier. */
export const DEVICE_ID_KEY = 'sync:deviceId'

/**
 * Returns the persisted device UUID for this browser/device.
 *
 * On first call: generates a UUID v4 via `crypto.randomUUID()`, writes it
 * to `localStorage[DEVICE_ID_KEY]`, and returns it.
 * On subsequent calls: reads and returns the stored value.
 *
 * @returns A stable UUID v4 string that identifies this device.
 */
export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) {
    return existing
  }
  const id = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, id)
  return id
}
