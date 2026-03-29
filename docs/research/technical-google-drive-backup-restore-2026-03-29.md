---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Google Drive API v3 for Course Backup/Restore'
research_goals: 'Enable premium Knowlune users to back up and restore their course data (IndexedDB) to Google Drive, using minimal OAuth scopes, with folder structure per course, resumable uploads, and quota awareness'
user_name: 'Pedro'
date: '2026-03-29'
web_research_enabled: true
source_verification: true
---

# Google Drive API v3 for Course Backup/Restore: Comprehensive Technical Research for Knowlune

**Date:** 2026-03-29
**Author:** Pedro
**Research Type:** Technical

---

## Executive Summary

This report presents a comprehensive technical analysis of integrating Google Drive API v3 into Knowlune for premium-only course data backup and restore. The goal is to allow authenticated users to push their IndexedDB data (courses, progress, notes, bookmarks, study sessions, etc.) to Google Drive as structured JSON bundles, and restore from those backups on any device.

The recommended approach uses the **`drive.file` scope** (per-file access to app-created files only) for minimal permissions, combined with a **visible folder structure** (`Knowlune/` root with per-course subfolders) in the user's Drive rather than the hidden `appDataFolder`. Backups should use a **single `.knowlune.json` bundle** per backup operation (matching the existing `exportService.ts` `KnowluneExport` schema), with **multipart upload** for typical backups under 5 MB and **resumable upload** for larger ones. Google Identity Services (GIS) provides browser-native OAuth 2.0 token acquisition without requiring a backend.

**Key Findings:**

- The `drive.file` scope is the narrowest practical scope: it only grants access to files the app itself creates, requires no sensitive/restricted scope review, and aligns with Google's principle of least privilege.
- The existing `exportAllAsJson()` in `src/lib/exportService.ts` already produces a `KnowluneExport` object with the exact schema needed for Drive backup -- the integration layer is thin.
- Google Identity Services (GIS) `initTokenClient` + `requestAccessToken()` provides a browser-only OAuth flow that works without a backend, integrating cleanly with the existing Supabase auth (E19) as a separate authorization concern.
- Resumable uploads are required for files >5 MB but typical Knowlune backups (courses metadata + progress + notes) will be well under 5 MB; multipart upload is the default path.
- Storage quota can be checked via `about.get()` before upload to provide clear UX when the user's Drive is full.
- Google Workspace accounts have the same API behavior but may have org-level policies restricting third-party app access; personal accounts are unrestricted.

**Key Recommendations:**

1. Use `drive.file` scope (not `drive` or `drive.appdata`) for user-visible, user-controllable backups
2. Reuse the existing `KnowluneExport` interface as the backup format -- no new schema needed
3. Build a `GoogleDriveService` class that wraps raw `fetch()` calls to the Drive REST API (no need for the full `googleapis` npm package in a browser SPA)
4. Implement folder-based organization: `Knowlune/backups/YYYY-MM-DD_HHmmss.knowlune.json`
5. Gate behind premium tier with Supabase subscription check

---

## Table of Contents

1. [OAuth 2.0 Scopes and Authentication](#1-oauth-20-scopes-and-authentication)
2. [File CRUD Operations](#2-file-crud-operations)
3. [Folder Structure Strategy](#3-folder-structure-strategy)
4. [Backup File Format](#4-backup-file-format)
5. [Upload Strategy (Multipart vs Resumable)](#5-upload-strategy-multipart-vs-resumable)
6. [Storage Quota Checking](#6-storage-quota-checking)
7. [Google Workspace vs Personal Account Differences](#7-google-workspace-vs-personal-account-differences)
8. [Integration with Existing exportService.ts](#8-integration-with-existing-exportservicets)
9. [Architecture and Implementation Plan](#9-architecture-and-implementation-plan)
10. [Security Considerations](#10-security-considerations)
11. [Risk Assessment](#11-risk-assessment)
12. [Sources and References](#12-sources-and-references)

---

## 1. OAuth 2.0 Scopes and Authentication

### Scope Selection: `drive.file`

The `drive.file` scope (`https://www.googleapis.com/auth/drive.file`) is the recommended choice for Knowlune:

| Scope | Access Level | Review Required | Knowlune Fit |
|-------|-------------|-----------------|--------------|
| `drive` | Full read/write to ALL Drive files | Restricted (security review) | Overkill, privacy risk |
| `drive.readonly` | Read ALL Drive files | Sensitive | Not needed |
| `drive.appdata` | Hidden appDataFolder only | Non-sensitive | Users can't see/manage backups |
| **`drive.file`** | **Only files created by the app** | **Non-sensitive** | **Best fit** |
| `drive.metadata.readonly` | Read metadata only | Sensitive | Insufficient |

**Why `drive.file` over `drive.appdata`:**
- `drive.appdata` stores files in a hidden folder users cannot browse -- backups become invisible and unmanageable
- `drive.appdata` is deleted when the user uninstalls the app (removes consent) -- catastrophic for backup purposes
- `drive.file` creates visible files the user can see in their Drive, rename, share, or manually delete
- `drive.file` is still non-sensitive (no extra Google review required for OAuth consent screen)
- The trade-off: `drive.file` only accesses files the app created, so it cannot read pre-existing user files (which is exactly what we want)

_Source: [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)_
_Source: [Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata)_

### Google Identity Services (GIS) for Browser OAuth

Since Knowlune is a browser SPA (React + Vite), the recommended approach is Google Identity Services (GIS) using the **implicit token model**:

```typescript
// Initialize token client (once, on app load)
const tokenClient = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/drive.file',
  callback: (tokenResponse) => {
    if (tokenResponse.error) {
      // Handle error
      return
    }
    // Store access_token for Drive API calls
    accessToken = tokenResponse.access_token
  },
})

// Trigger consent flow (on user action, e.g. "Connect Google Drive" button)
tokenClient.requestAccessToken()
```

**Key characteristics:**
- No backend needed for token exchange (implicit flow returns access token directly)
- Access tokens are short-lived (~1 hour) -- must re-request on expiry via `requestAccessToken()` from a user gesture
- Consent is remembered per user per Client ID -- subsequent calls skip the consent screen
- Incremental authorization: can request additional scopes later if needed
- Works alongside Supabase auth -- they are independent authorization concerns (Supabase = app auth, GIS = Drive access)

**Alternative: Authorization Code Flow with PKCE**
Google's web application OAuth does not currently support public clients (no client_secret) for the authorization code flow under the "Web Application" profile. For a pure browser SPA without a backend token exchange endpoint, the implicit token model via GIS is the practical choice. If Knowlune later adds a backend (e.g., Express proxy), authorization code flow with server-side token exchange becomes possible and preferred for long-lived refresh tokens.

_Source: [Using the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)_
_Source: [Google Account Authorization JavaScript API reference](https://developers.google.com/identity/oauth2/web/reference/js-reference)_
_Source: [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)_

### Integration with Supabase Auth (E19)

Knowlune already has Supabase auth in `src/lib/auth/supabase.ts`. The Google Drive OAuth is a **separate authorization** -- it does not replace or duplicate Supabase auth:

- **Supabase**: Handles user identity, subscription tier (premium gate), and app-level data sync
- **Google Drive OAuth**: Handles access to the user's Google Drive for backup/restore only
- The Google access token should be stored in memory (not localStorage) for the session duration
- Premium tier check happens via Supabase before showing the Drive backup UI

---

## 2. File CRUD Operations

### Drive API v3 REST Endpoints

All operations use `fetch()` with the access token in the `Authorization: Bearer` header:

| Operation | Method | Endpoint | Use Case |
|-----------|--------|----------|----------|
| **Create file** | POST | `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` | Upload backup JSON |
| **Create folder** | POST | `https://www.googleapis.com/drive/v3/files` | Create Knowlune/ folder |
| **List files** | GET | `https://www.googleapis.com/drive/v3/files?q=...` | Find existing backups |
| **Get file** | GET | `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` | Download backup for restore |
| **Get metadata** | GET | `https://www.googleapis.com/drive/v3/files/{fileId}` | Get backup details |
| **Delete file** | DELETE | `https://www.googleapis.com/drive/v3/files/{fileId}` | Remove old backups |
| **Update file** | PATCH | `https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=multipart` | Overwrite backup |

### Creating a Folder

```typescript
async function createFolder(name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) {
    metadata.parents = [parentId]
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })
  const data = await res.json()
  return data.id
}
```

### Finding an Existing Folder

```typescript
async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return data.files?.[0]?.id ?? null
}
```

### Multipart File Upload

```typescript
async function uploadFile(
  name: string,
  content: string,
  parentId: string,
  mimeType = 'application/json'
): Promise<string> {
  const metadata = { name, parents: [parentId], mimeType }
  const boundary = '---knowlune-backup-boundary'

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  const data = await res.json()
  return data.id
}
```

_Source: [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads)_
_Source: [Method: files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)_
_Source: [Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder)_

---

## 3. Folder Structure Strategy

### Recommended Structure

```
My Drive/
  Knowlune/
    backups/
      2026-03-29_143022.knowlune.json    # Full backup
      2026-03-28_091500.knowlune.json    # Previous backup
      2026-03-25_170000.knowlune.json    # Older backup
```

**Design decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Root folder name | `Knowlune/` | Brand-identifiable, easy for users to find |
| Subfolder | `backups/` | Separates backups from potential future features (e.g., exported notes) |
| File naming | `YYYY-MM-DD_HHmmss.knowlune.json` | Sortable, human-readable, unique per second |
| Per-course folders | **No** | A single JSON bundle is simpler, atomic, and avoids partial-backup states |
| Max backups | 10 (configurable) | Auto-prune oldest when limit reached; saves Drive quota |

**Why NOT per-course subfolders:**
- Atomic backups are safer -- either the full backup succeeds or fails, no partial states
- The `KnowluneExport` schema already bundles all data together
- Individual course files would require complex reconciliation logic on restore
- A single JSON file for all course data is typically 100 KB - 2 MB (well within limits)

### Folder Initialization Flow

```
1. Check if "Knowlune" folder exists in root  → findFolder("Knowlune")
2. If not, create it                          → createFolder("Knowlune")
3. Check if "backups" subfolder exists         → findFolder("backups", knowluneId)
4. If not, create it                          → createFolder("backups", knowluneId)
5. Cache folder IDs in memory for session
```

**Folder depth limit:** Google Drive allows up to 100 levels of nesting. With only 2 levels (Knowlune/backups/), this is not a concern.

_Source: [Files and folders overview](https://developers.google.com/drive/api/guides/about-files)_
_Source: [Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder)_

---

## 4. Backup File Format

### Recommended: Single `.knowlune.json` Bundle

The existing `KnowluneExport` interface in `src/lib/exportService.ts` is the ideal backup format:

```typescript
interface KnowluneExport {
  schemaVersion: number       // Currently 14
  exportedAt: string          // ISO 8601 timestamp
  data: {
    settings: Record<string, unknown>
    importedCourses: Omit<ImportedCourse, 'directoryHandle'>[]
    importedVideos: Omit<ImportedVideo, 'fileHandle'>[]
    importedPdfs: Omit<ImportedPdf, 'fileHandle'>[]
    progress: VideoProgress[]
    bookmarks: VideoBookmark[]
    notes: Note[]
    studySessions: StudySession[]
    contentProgress: ContentProgress[]
    challenges: Challenge[]
    reviewRecords: ReviewRecord[]
    learningPaths: LearningPath[]
    learningPathEntries: LearningPathEntry[]
    aiUsageEvents: AIUsageEvent[]
  }
}
```

**Format comparison:**

| Format | Pros | Cons | Verdict |
|--------|------|------|---------|
| `.knowlune.json` (single bundle) | Atomic, simple restore, reuses existing schema, compressible | Slightly larger than needed for partial restore | **Recommended** |
| Individual JSON files per table | Granular restore possible | Complex, partial states, many API calls | Over-engineered |
| `.zip` bundle | Smaller on wire | Browser zip adds dependency, Drive doesn't preview | Unnecessary (<5 MB typical) |
| Binary format (protobuf) | Compact | Not human-readable, new dependency, no Drive preview | Overkill |

**Non-serializable fields:** The existing export already strips `directoryHandle`, `fileHandle`, and other non-serializable fields. No additional stripping is needed for Drive backup.

**Size estimate for typical usage:**
- 10 courses with metadata: ~50 KB
- 500 study sessions: ~100 KB
- 200 notes (HTML content): ~500 KB - 1 MB
- 1,000 progress records: ~150 KB
- **Total typical backup: 500 KB - 2 MB**

---

## 5. Upload Strategy (Multipart vs Resumable)

### Decision Framework

| Upload Type | When to Use | Max Size | API Calls |
|-------------|-------------|----------|-----------|
| **Simple** | Metadata only (no body) | 5 MB | 1 |
| **Multipart** | Metadata + small file | 5 MB | 1 |
| **Resumable** | Large files, unreliable connections | 5 TB | 2+ |

**For Knowlune backups:**
- Typical backup size: 500 KB - 2 MB → **multipart upload** (single API call)
- Edge case (heavy user with thousands of notes): 5-10 MB → **resumable upload**
- Threshold: Use multipart for <5 MB, switch to resumable for >=5 MB

### Resumable Upload Implementation

Resumable upload is a two-phase process:

**Phase 1: Initiate session**
```typescript
async function initiateResumableUpload(
  metadata: Record<string, unknown>,
  contentLength: number
): Promise<string> {
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/json',
        'X-Upload-Content-Length': String(contentLength),
      },
      body: JSON.stringify(metadata),
    }
  )
  // The resumable session URI is in the Location header
  return res.headers.get('Location')!
}
```

**Phase 2: Upload content (single request for files <5 MB, chunked for larger)**
```typescript
async function uploadToSession(sessionUri: string, content: string): Promise<string> {
  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: content,
  })
  const data = await res.json()
  return data.id
}
```

**Chunk size constraints:** Chunks must be multiples of 256 KB. Default chunk size is 50 MB. For Knowlune, chunking is unlikely to be needed since backups rarely exceed 5 MB.

**Error recovery:** For 4xx errors during resumable upload, the session is expired and must be restarted. For 5xx or network errors, retry with exponential backoff.

_Source: [Upload file data - Resumable](https://developers.google.com/workspace/drive/api/guides/manage-uploads)_
_Source: [Google Drive API, Resumable upload - Javascript](https://medium.com/@ritwiksinha25/google-drive-api-resumable-upload-javascript-ede41298c99d)_

---

## 6. Storage Quota Checking

### Pre-Upload Quota Check

Before uploading, check available storage to provide a clear error message instead of a cryptic 403:

```typescript
async function checkStorageQuota(): Promise<{
  limit: number    // bytes, -1 if unlimited
  usage: number    // bytes
  available: number // bytes, -1 if unlimited
}> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  const quota = data.storageQuota

  const limit = quota.limit ? parseInt(quota.limit) : -1
  const usage = parseInt(quota.usage)
  const available = limit === -1 ? -1 : limit - usage

  return { limit, usage, available }
}
```

### Quota Fields (About.StorageQuota)

| Field | Description |
|-------|-------------|
| `limit` | Total storage limit in bytes (absent if unlimited) |
| `usage` | Total usage across all Google services |
| `usageInDrive` | Usage by Drive files specifically |
| `usageInDriveTrash` | Usage by trashed Drive files |

### Scope Requirement

The `about.get()` endpoint works with the `drive.file` scope -- no additional scope is needed.

### UX Flow

```
1. User taps "Backup to Drive"
2. Check quota: available = limit - usage
3. Estimate backup size (JSON.stringify(exportData).length)
4. If backup size > available:
     Show: "Not enough Drive storage. Need X MB, have Y MB available.
            Free up space or upgrade your Google storage."
5. Else: proceed with upload
```

_Source: [REST Resource: about](https://developers.google.com/workspace/drive/api/reference/rest/v3/about)_
_Source: [About.StorageQuota](https://googleapis.dev/java/google-api-services-drive/latest/com/google/api/services/drive/model/About.StorageQuota.html)_

---

## 7. Google Workspace vs Personal Account Differences

### API Behavior

| Aspect | Personal (Gmail) | Google Workspace |
|--------|------------------|------------------|
| API rate limits | 20,000 calls/100s | Same |
| Write rate limit | 3 writes/sec sustained | Same |
| Upload limit | 750 GB/24h rolling | Same |
| File count limit | 500,000 items total | Same |
| Storage quota | 15 GB free (shared with Gmail, Photos) | Depends on plan (30 GB - unlimited) |
| `drive.file` scope | Works | Works (unless admin blocks third-party apps) |
| OAuth consent | Standard | May require admin pre-approval |
| Shared Drives | Not available | Available (but not relevant for personal backups) |

### Key Differences That Affect Knowlune

1. **Admin restrictions:** Workspace admins can block third-party app access entirely or require pre-approval. Knowlune should handle the `403 access_denied` error gracefully with a message like "Your organization may restrict Google Drive access from third-party apps. Contact your admin."

2. **Storage limits:** Personal accounts share 15 GB across Gmail, Drive, and Photos. A typical Knowlune backup of ~1 MB is negligible, but the quota check is still important for users near their limit.

3. **Pooled storage:** Workspace organizations may use pooled storage, where `storageQuota.limit` reflects the org limit, not individual. The quota check still works but the number may be misleading.

4. **OAuth consent screen:** For unverified apps, Google shows a warning. To avoid this, the app should go through Google's verification process (which is straightforward for `drive.file` since it's non-sensitive).

_Source: [Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)_
_Source: [Requesting Minimum Scopes](https://support.google.com/cloud/answer/13807380?hl=en)_

---

## 8. Integration with Existing exportService.ts

### Current Export Architecture

The existing `src/lib/exportService.ts` provides:

- `exportAllAsJson()` -- Returns a `KnowluneExport` object with all IndexedDB data
- `exportAllAsCsv()` -- CSV format (not needed for Drive backup)
- `exportNotesAsMarkdown()` -- Markdown format (not needed for Drive backup)
- Progress callbacks (`ExportProgressCallback`) for UI feedback
- Non-serializable field stripping (handles, blobs)
- Schema versioning (`CURRENT_SCHEMA_VERSION = 14`)

### Integration Strategy: Thin Wrapper

The Drive backup service should **reuse** `exportAllAsJson()` rather than reimplementing data collection:

```typescript
// src/services/googleDriveBackupService.ts

import { exportAllAsJson, type KnowluneExport } from '@/lib/exportService'
import { GoogleDriveService } from './googleDriveService'

export async function backupToDrive(
  driveService: GoogleDriveService,
  onProgress?: (percent: number, phase: string) => void
): Promise<{ fileId: string; fileName: string }> {
  // Phase 1: Export from IndexedDB (reuse existing service)
  onProgress?.(0, 'Collecting data...')
  const exportData = await exportAllAsJson((percent, phase) => {
    onProgress?.(Math.round(percent * 0.6), phase) // 0-60% for export
  })

  // Phase 2: Upload to Drive
  onProgress?.(60, 'Uploading to Google Drive...')
  const json = JSON.stringify(exportData)
  const fileName = `${formatDate(new Date())}.knowlune.json`

  const backupsFolderId = await driveService.ensureBackupsFolder()
  const fileId = await driveService.uploadFile(fileName, json, backupsFolderId)

  // Phase 3: Cleanup old backups
  onProgress?.(90, 'Cleaning up old backups...')
  await driveService.pruneOldBackups(backupsFolderId, MAX_BACKUPS)

  onProgress?.(100, 'Backup complete!')
  return { fileId, fileName }
}
```

### Restore Flow

```typescript
export async function restoreFromDrive(
  driveService: GoogleDriveService,
  fileId: string,
  onProgress?: (percent: number, phase: string) => void
): Promise<void> {
  // Phase 1: Download from Drive
  onProgress?.(0, 'Downloading backup...')
  const json = await driveService.downloadFile(fileId)
  const exportData: KnowluneExport = JSON.parse(json)

  // Phase 2: Validate schema version
  if (exportData.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Backup requires app version with schema ${exportData.schemaVersion}`)
  }

  // Phase 3: Import to IndexedDB (needs import service -- new code)
  onProgress?.(30, 'Restoring data...')
  await importFromJson(exportData, (percent, phase) => {
    onProgress?.(30 + Math.round(percent * 0.7), phase)
  })

  onProgress?.(100, 'Restore complete!')
}
```

**Note:** An `importFromJson()` function does not exist yet in the codebase. The export service is write-only. A restore/import service will need to be built as part of the Google Drive backup epic, handling:
- Schema migration (if backup version < current version)
- Conflict resolution (merge vs overwrite)
- Transaction safety (Dexie transaction wrapping)
- Rollback on failure

---

## 9. Architecture and Implementation Plan

### Proposed File Structure

```
src/
  services/
    googleDriveService.ts          # Low-level Drive API wrapper (fetch-based)
    googleDriveBackupService.ts    # Backup/restore orchestration
  lib/
    exportService.ts               # Existing (reused for data collection)
    importService.ts               # NEW: restore data into IndexedDB
  stores/
    useGoogleDriveStore.ts         # Zustand store for Drive connection state
  app/
    components/
      settings/
        GoogleDriveBackupPanel.tsx  # UI for backup/restore in Settings
```

### Dependency Graph

```
GoogleDriveBackupPanel (UI)
  └── useGoogleDriveStore (state)
        └── googleDriveBackupService (orchestration)
              ├── exportService.ts (data out - existing)
              ├── importService.ts (data in - new)
              └── googleDriveService.ts (Drive API)
                    └── Google Identity Services (OAuth)
```

### No New npm Dependencies Required

The entire integration can be built with:
- **Google Identity Services**: Loaded via `<script>` tag (CDN), provides `google.accounts.oauth2`
- **fetch API**: Native browser API for Drive REST calls
- **Existing Dexie.js**: For IndexedDB read/write during export/import

No need for `googleapis`, `google-auth-library`, or any Google npm packages. This keeps the bundle size minimal.

### Google Cloud Console Setup

Required one-time setup:
1. Create OAuth 2.0 Client ID (Web application type)
2. Add authorized JavaScript origins (localhost:5173, production domain)
3. Add `drive.file` scope to OAuth consent screen
4. Submit for Google verification (straightforward for non-sensitive scopes)

### Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| 1. GIS OAuth integration | Token client, connect/disconnect, token refresh | 1 story |
| 2. Drive service layer | Folder management, file CRUD, quota check | 1 story |
| 3. Backup flow | Export + upload + pruning + progress UI | 1 story |
| 4. Restore flow | Download + import + schema migration + conflict resolution | 1-2 stories |
| 5. Settings UI | Backup panel, backup list, restore picker, status display | 1 story |

---

## 10. Security Considerations

### Token Storage

- Access tokens are **memory-only** (not localStorage, not cookies) -- they expire in ~1 hour
- No refresh tokens in the implicit flow -- user re-authorizes when token expires
- Token is scoped to `drive.file` only -- even if compromised, it can only access Knowlune-created files

### Data Privacy

- Backup JSON contains user learning data (notes, progress, bookmarks) -- no credentials or tokens
- The existing export already strips auth tokens via the `EXPORTABLE_LS_PREFIXES` allowlist
- Drive files are in the user's own account -- Knowlune never sees other users' backups

### OAuth Consent Screen

- `drive.file` is a non-sensitive scope -- no restricted scope review required
- The app should still go through verification to remove the "unverified app" warning
- Clear privacy policy needed explaining what data is stored in Drive

### CORS

- Google Drive API supports CORS for browser-based requests
- No proxy server needed for Drive API calls from the browser

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token expires mid-upload | Medium | Low | Detect 401, re-request token, retry |
| User revokes Drive access | Low | Medium | Handle 403 gracefully, prompt reconnect |
| Workspace admin blocks access | Medium | Low | Clear error message with admin contact guidance |
| Backup too large for multipart | Low | Low | Auto-switch to resumable for >5 MB |
| Drive quota full | Low | Medium | Pre-upload quota check with clear UX |
| Schema version mismatch on restore | Medium | Medium | Migration functions for each schema version |
| Partial restore failure | Low | High | Dexie transaction with rollback |
| Google API rate limiting | Very Low | Low | Exponential backoff, max 3 retries |
| GIS library fails to load | Low | Medium | Graceful degradation, show "Drive unavailable" |

---

## 12. Sources and References

### Official Google Documentation
- [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Store application-specific data (appDataFolder)](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder)
- [Files and folders overview](https://developers.google.com/drive/api/guides/about-files)
- [REST Resource: about (storage quota)](https://developers.google.com/workspace/drive/api/reference/rest/v3/about)
- [Method: files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- [Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
- [Resolve errors](https://developers.google.com/workspace/drive/api/guides/handle-errors)
- [JavaScript quickstart](https://developers.google.com/workspace/drive/api/quickstart/js)

### Google Identity Services
- [Using the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Account Authorization JavaScript API reference](https://developers.google.com/identity/oauth2/web/reference/js-reference)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Choose a user authorization model](https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model)
- [Requesting Minimum Scopes](https://support.google.com/cloud/answer/13807380?hl=en)

### Community Resources
- [Google Drive API, Resumable upload - Javascript (Medium)](https://medium.com/@ritwiksinha25/google-drive-api-resumable-upload-javascript-ede41298c99d)
- [ResumableUploadForGoogleDrive_js (GitHub)](https://github.com/tanaikech/ResumableUploadForGoogleDrive_js)
- [Upload Files to Google Drive using Javascript (GitHub Gist)](https://gist.github.com/tanaikech/bd53b366aedef70e35a35f449c51eced)
- [Using Google Drive API v3 to upload a file (React) - DEV Community](https://dev.to/arnabsen1729/using-google-drive-api-v3-to-upload-a-file-to-drive-using-react-4loi)
- [@react-oauth/google npm package](https://www.npmjs.com/package/@react-oauth/google)
- [IndexedDB Export/Import (GitHub)](https://github.com/Polarisation/indexeddb-export-import)

### Knowlune Codebase References
- `src/lib/exportService.ts` -- Existing export service with `KnowluneExport` schema
- `src/lib/auth/supabase.ts` -- Existing Supabase auth client
- `src/data/types.ts` -- Data type definitions for all IndexedDB tables
- `src/db/schema.ts` -- Dexie database schema

---

**Research Completion Date:** 2026-03-29
**Document Length:** Comprehensive coverage of all requested topics
**Source Verification:** All technical claims verified against official Google documentation
**Confidence Level:** High -- based on official Google Developer documentation and verified community implementations
