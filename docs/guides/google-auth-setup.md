# Google OAuth Setup Guide for Knowlune

> **Prerequisite:** Self-hosted Supabase running on Unraid (`titan.local:8000` / `supabase.pedrolages.net`)
>
> **Time:** ~15 minutes
>
> **Result:** "Continue with Google" button on the login page works

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name: `Knowlune` (or any name)
4. Click **Create**
5. Select the new project from the dropdown

## Step 2: Enable the Google Identity API

1. Go to **APIs & Services** → **Library**
2. Search for **"Google Identity"** or **"Google+ API"**
3. Click **Google Identity Services** (or Google+ API if Identity isn't available)
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → **Create**
3. Fill in:
   - **App name:** `Knowlune`
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue**
5. **Scopes** — click **Add or Remove Scopes**:
   - Select `email` and `profile` (openid is auto-included)
   - Click **Update** → **Save and Continue**
6. **Test users** — add your Google email address
7. Click **Save and Continue** → **Back to Dashboard**

> **Note:** While in "Testing" mode, only test users you add can sign in. Move to "Production" when ready for all users (requires Google verification for apps with >100 users).

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Knowlune Web`
5. **Authorized JavaScript origins** — add:
   ```
   http://localhost:5173
   http://localhost:4173
   http://titan.local:8000
   ```
   For production, also add:
   ```
   https://supabase.pedrolages.net
   https://knowlune.yourdomain.com
   ```

6. **Authorized redirect URIs** — add:
   ```
   http://titan.local:8000/auth/v1/callback
   ```
   For production, also add:
   ```
   https://supabase.pedrolages.net/auth/v1/callback
   ```

7. Click **Create**
8. **Copy the Client ID and Client Secret** — you'll need these in Step 5

## Step 5: Configure Supabase Google Provider

### Option A: Via Supabase Dashboard UI

1. Open your Supabase dashboard:
   - Self-hosted: `http://titan.local:8000` → Studio (usually port 3000 or via Kong)
   - Or: `https://supabase.pedrolages.net` if you have Studio exposed
2. Go to **Authentication** → **Providers**
3. Find **Google** → click to expand
4. Toggle **Enable Sign in with Google** → ON
5. Paste:
   - **Client ID:** from Step 4
   - **Client Secret:** from Step 4
6. Click **Save**

### Option B: Via Supabase config.toml (self-hosted)

If your Supabase Studio isn't exposed, edit the config directly:

1. SSH into your Unraid server
2. Find your Supabase config (usually in the Docker volume):
   ```bash
   # Location varies by setup — check your Docker compose
   nano /path/to/supabase/volumes/api/kong.yml
   # Or edit the gotrue config directly
   ```
3. Set these environment variables for the GoTrue (auth) service:
   ```env
   GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
   GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id-here
   GOTRUE_EXTERNAL_GOOGLE_SECRET=your-client-secret-here
   GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=http://titan.local:8000/auth/v1/callback
   ```
4. Restart the GoTrue container:
   ```bash
   docker restart supabase-auth
   ```

## Step 6: Configure Supabase Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL:** `http://localhost:5173` (or your production URL)
3. **Redirect URLs** — add all allowed redirect destinations:
   ```
   http://localhost:5173
   http://localhost:5173/**
   http://localhost:4173
   http://localhost:4173/**
   http://localhost:4174
   http://localhost:4175
   ```
   For production:
   ```
   https://knowlune.yourdomain.com
   https://knowlune.yourdomain.com/**
   ```
4. Click **Save**

## Step 7: Test Locally

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173`
3. Click the user avatar → **Sign In**
4. Switch to the **Google** tab
5. Click **Continue with Google**
6. Sign in with your Google account (must be a test user from Step 3)
7. You should be redirected back to Knowlune, now authenticated

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
The redirect URI in Google Console doesn't match what Supabase sends.
- Check Step 4.6: redirect URI must be exactly `http://titan.local:8000/auth/v1/callback`
- No trailing slash

### "Access blocked: This app's request is invalid"
OAuth consent screen not configured properly.
- Check Step 3: ensure email and profile scopes are added
- Ensure your email is added as a test user (Step 3.6)

### Google button does nothing / shows generic error
Supabase Google provider not enabled.
- Check Step 5: Google provider must be toggled ON in Supabase
- Verify Client ID and Secret are pasted correctly (no extra spaces)

### Redirect loops or blank page after Google sign-in
Supabase redirect URL misconfigured.
- Check Step 6: `http://localhost:5173` must be in the allowed redirect URLs
- The `redirectTo` in code is `window.location.origin` — ensure it matches

### "Supabase not configured" error
Missing env vars.
- Check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after changing `.env`

## Files Reference

| File | What It Does |
|------|-------------|
| `src/lib/auth/supabase.ts` | Supabase client singleton (reads env vars) |
| `src/stores/useAuthStore.ts:99-114` | `signInWithGoogle()` — calls `supabase.auth.signInWithOAuth()` |
| `src/app/components/auth/GoogleAuthButton.tsx` | "Continue with Google" button UI |
| `src/app/components/auth/AuthDialog.tsx` | Login dialog with Email/Magic Link/Google tabs |
| `.env` | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |

## Production Checklist

- [ ] Move OAuth consent screen from "Testing" to "Production" (if >100 users)
- [ ] Add production domain to Google Console authorized origins
- [ ] Add production Supabase URL to redirect URIs
- [ ] Update Supabase Site URL to production domain
- [ ] Test sign-in flow on production
- [ ] Verify JWT middleware validates Google-issued tokens correctly
