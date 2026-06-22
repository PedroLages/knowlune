/**
 * DataAndBackupSection — E77a-S01
 *
 * Settings > Data & Backup section.
 *
 * Provides two primary actions:
 *   1. Download a complete .knowlune.json backup of all syncable data
 *   2. Restore from a previously downloaded backup file
 *
 * Not auth-gated — backup/restore is device-local and works for guests too.
 *
 * @see DataAndBackupPanel for the actual UI
 */

import { DataAndBackupPanel } from '@/app/components/settings/DataAndBackupPanel'

export function DataAndBackupSection() {
  return (
    <div className="space-y-6" data-testid="data-backup-section">
      <DataAndBackupPanel />
    </div>
  )
}
