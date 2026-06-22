# Supabase Google OAuth Drive Scope Setup

## Purpose

Enable Drive API access from the Supabase Google OAuth provider so the app can
request `drive.file` scope during sign-in.

## Steps

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

## How It Works

- On next Google sign-in, Supabase includes `drive.file` in the OAuth consent
  screen request.
- The `signInWithGoogle()` action in `useAuthStore` also passes `scopes` and
  `queryParams` (`access_type=offline` + `prompt=consent`) to ensure a
  `provider_refresh_token` is issued on first auth.
- The authorization token is stored in `session.provider_token` and accessible
  via `getDriveToken()` in `src/lib/googleDriveToken.ts`.

## Existing Users

Users who already signed in with Google before this change will **not** have
Drive scope on their current session. They must sign out and sign in again
(or re-authenticate via a re-auth prompt) to grant the new scope. The UI for
this prompt is implemented in story S03.

## Verification

After setup and a fresh Google sign-in:

```ts
const token = await getDriveToken()
// token should be a non-null string — the Google OAuth access token
```

The `drive.file` scope allows creating/reading files in an app-created folder
that the user cannot see in their Google Drive UI. It does **not** grant access
to existing files unless the user explicitly picks them via the Drive Picker.
