-- E50-S03: Calendar feed tokens for iCal subscription URLs
-- Stores one active token per user. Token is used in feed URL for calendar app subscriptions.
-- Server validates token to serve personalized iCal feed.

CREATE TABLE public.calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  CONSTRAINT unique_user_token UNIQUE (user_id)
);

CREATE INDEX idx_calendar_tokens_token ON public.calendar_tokens(token);

ALTER TABLE public.calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own token
CREATE POLICY "Users read own calendar token"
  ON public.calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own token
CREATE POLICY "Users insert own calendar token"
  ON public.calendar_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own token
CREATE POLICY "Users update own calendar token"
  ON public.calendar_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own token
CREATE POLICY "Users delete own calendar token"
  ON public.calendar_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
