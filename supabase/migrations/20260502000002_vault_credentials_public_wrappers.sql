-- E95-S02: Public-schema SECURITY DEFINER wrappers for vault operations.
--
-- The vault-credentials Edge Function calls these via supabase-js .rpc().
-- Direct .from('vault.secrets') doesn't work because PostgREST only exposes
-- schema 'public' by default — calling .from('vault.secrets') is interpreted
-- as a literal table name "vault.secrets" in the public schema.
--
-- The Edge Function authenticates via JWT, then uses service-role to call
-- these wrappers. Wrappers are restricted to service_role only.

CREATE OR REPLACE FUNCTION public.vault_get_secret_id_by_name(p_name text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT id FROM vault.secrets WHERE name = p_name LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.vault_create_secret(
  p_secret text,
  p_name text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := vault.create_secret(p_secret, p_name, p_description);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_update_secret_by_name(
  p_name text,
  p_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', p_name USING ERRCODE = 'P0002';
  END IF;
  PERFORM vault.update_secret(v_id, p_secret);
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_read_secret_by_name(p_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret_by_name(p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM vault.secrets WHERE name = p_name;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_get_secret_id_by_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_create_secret(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_update_secret_by_name(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_read_secret_by_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_delete_secret_by_name(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vault_get_secret_id_by_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_update_secret_by_name(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_read_secret_by_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret_by_name(text) TO service_role;

COMMENT ON FUNCTION public.vault_create_secret(text, text, text) IS
  'E95-S02: public wrapper for vault.create_secret. Called by vault-credentials Edge Function.';
