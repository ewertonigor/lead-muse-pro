
CREATE OR REPLACE FUNCTION public.notify_stage_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign RECORD;
  v_url TEXT := 'https://htfdaiznselpyxfzyeas.supabase.co';
  v_key TEXT;
BEGIN
  IF NEW.stage_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  FOR v_campaign IN
    SELECT id FROM public.campaigns
    WHERE workspace_id = NEW.workspace_id
      AND trigger_stage_id = NEW.stage_id
      AND is_active = true
  LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/generate-messages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'lead_id', NEW.id,
        'campaign_id', v_campaign.id,
        'trigger_source', 'auto_stage_trigger'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leads_notify_stage ON public.leads;
CREATE TRIGGER trg_leads_notify_stage
AFTER INSERT OR UPDATE OF stage_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.notify_stage_trigger();
