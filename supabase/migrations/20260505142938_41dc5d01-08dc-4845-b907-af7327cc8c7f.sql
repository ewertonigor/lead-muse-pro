
DO $$
DECLARE
  v_existing UUID;
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing, 'REPLACE_ME_KEY');
  ELSE
    PERFORM vault.create_secret('REPLACE_ME_KEY', 'service_role_key', 'Used by notify_stage_trigger');
  END IF;
END $$;
