
CREATE OR REPLACE FUNCTION public._set_service_role_secret(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_key, 'service_role_key', 'Used by notify_stage_trigger');
  ELSE
    PERFORM vault.update_secret(v_id, p_key);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._set_service_role_secret(TEXT) FROM PUBLIC, anon, authenticated;
