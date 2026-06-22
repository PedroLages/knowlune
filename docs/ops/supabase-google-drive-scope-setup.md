# Supabase Google OAuth Drive Scope Setup

## Purpose

Enable Drive API access from the Supabase Google OAuth provider so the app can
request `drive.file` scope during sign-in and `drive.readonly` scope for the
folder browser import feature.

## Steps

### Base Scope (`drive.file`)

1. **Open the Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard/project/<PROJECT_REF>

2. **Go to Authentication > Providers**
   - Sidebar: Authentication -> Providers

3. **Select Google**
   - Click the **Google** provider card to edit its configuration

4. **Add Drive scope**
   - Scroll to the **Additional Scopes** field
   - Append `https://www.googleapis.com/auth/drive.file` to the existing scopes
   - The full scopes string should be:
     ```
     email profile https://www.googleapis.com/auth/drive.file
     ```

5. **Save**
   - Click **Save** at the bottom of the form

### Incremental Read Scope (`drive.readonly`)

The `drive.readonly` scope is requested **incrementally** — not bundled into the
initial sign-in. When the user first tries to use the Drive folder browser in
the import wizard, the app triggers a second OAuth flow:

1. The app calls `supabase.auth.signInWithOAuth()` with:
   ```
   scopes: 'email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
   queryParams: { access_type: 'offline', prompt: 'consent' }
   ```
2. The user grants read permission in the Google consent screen
3. The session is updated with a new `provider_token` that includes both scopes
4. The app stores a flag (`knowlune_drive_read_granted`) in localStorage

**Important:** Both `drive.file` and `drive.readonly` must be added to the
Supabase provider's "Additional Scopes" field for the incremental flow to work.
The full scopes string should be:

```
email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly
```

## How It Works

- On the **initial** Google sign-in, Supabase includes `drive.file` in the OAuth
  consent screen request. The `signInWithGoogle()` action passes `scopes` and
  `queryParams` (`access_type=offline` + `prompt=consent`) to ensure a
  `provider_refresh_token` is issued.
- When the user opens the Drive folder browser, `hasDriveReadScope()` checks
  whether the current `provider_token` has read access by making a lightweight
  Drive API call (`GET /drive/v3/about`). If it fails with a 403/insufficient
  scopes error, the app triggers the incremental OAuth flow via
  `requestDriveReadScope()`.
- After re-auth, the new `provider_token` is stored in the Supabase session and
  accessible via `getDriveToken()` in `src/lib/googleDriveToken.ts`.

## Existing Users

Users who already signed in with Google before this change will **not** have
Drive scope on their current session. They must sign out and sign in again
(or re-authenticate via a re-auth prompt) to grant the new scope. The UI for
this prompt is implemented in story S03.

The incremental `drive.readonly` flow will also trigger a re-auth for any user
who hasn't previously granted this scope.

## Verification

After setup and a fresh Google sign-in:

```ts
const token = await getDriveToken()
// token should be a non-null string — the Google OAuth access token
```

To verify the read scope specifically:

```ts
const hasRead = await checkDriveReadScope()
// hasRead should be true after a successful incremental re-auth
```

The `drive.file` scope allows creating/reading files in an app-created folder
that the user cannot see in their Google Drive UI. The `drive.readonly` scope
allows listing and reading files and folders across the user's Drive, which is
needed for the folder browser import feature.
