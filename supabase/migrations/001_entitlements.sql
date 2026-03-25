-- E19-S02: Entitlements table for subscription management
-- Stores the mapping between Supabase Auth users and their Stripe subscription status.
-- Webhook handler writes via service_role; clients read via RLS.

CREATE TABLE public.entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'trial', 'premium')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users can only read their own entitlement row.
-- Writes are performed by the stripe-webhook Edge Function using service_role key.
CREATE INDEX idx_entitlements_stripe_customer ON public.entitlements (stripe_customer_id);
CREATE INDEX idx_entitlements_stripe_subscription ON public.entitlements (stripe_subscription_id);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own entitlement"
  ON public.entitlements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Deny user writes on entitlements"
  ON public.entitlements
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny user updates on entitlements"
  ON public.entitlements
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny user deletes on entitlements"
  ON public.entitlements
  FOR DELETE
  TO authenticated
  USING (false);

-- Auto-create a 'free' entitlement row when a new user signs up.
-- This ensures every authenticated user has an entitlement record to query.
CREATE OR REPLACE FUNCTION public.handle_new_user_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.entitlements (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_entitlement
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_entitlement();
