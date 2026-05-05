
-- =========================================
-- EXTENSIONS
-- =========================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.field_type AS ENUM ('text', 'number', 'date', 'boolean', 'select');
CREATE TYPE public.activity_action AS ENUM (
  'lead_created', 'lead_updated', 'lead_stage_changed', 'lead_deleted',
  'message_generated', 'message_sent', 'campaign_created', 'campaign_updated'
);

-- =========================================
-- TIMESTAMP HELPER
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================
-- TABLES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'text',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  source TEXT,
  notes TEXT,
  stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
  custom_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context TEXT,
  prompt TEXT,
  trigger_stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  variations JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  action public.activity_action NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_workspace_members_ws_user ON public.workspace_members(workspace_id, user_id);
CREATE INDEX idx_stages_ws ON public.stages(workspace_id);
CREATE INDEX idx_custom_fields_ws ON public.custom_fields(workspace_id);
CREATE INDEX idx_leads_ws ON public.leads(workspace_id);
CREATE INDEX idx_leads_ws_stage ON public.leads(workspace_id, stage_id);
CREATE INDEX idx_leads_custom_data ON public.leads USING GIN (custom_data jsonb_path_ops);
CREATE INDEX idx_leads_name_trgm ON public.leads USING GIN (name gin_trgm_ops);
CREATE INDEX idx_leads_company_trgm ON public.leads USING GIN (company gin_trgm_ops);
CREATE INDEX idx_campaigns_ws ON public.campaigns(workspace_id);
CREATE INDEX idx_campaigns_trigger ON public.campaigns(workspace_id, trigger_stage_id) WHERE is_active = true;
CREATE INDEX idx_lead_messages_ws ON public.lead_messages(workspace_id);
CREATE INDEX idx_lead_messages_lead ON public.lead_messages(lead_id);
CREATE INDEX idx_activity_log_ws_created ON public.activity_log(workspace_id, created_at DESC);

-- =========================================
-- updated_at TRIGGERS
-- =========================================
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stages_updated BEFORE UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_custom_fields_updated BEFORE UPDATE ON public.custom_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- SECURITY DEFINER HELPERS
-- =========================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user UUID, _workspace UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user AND workspace_id = _workspace
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user UUID, _workspace UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user AND workspace_id = _workspace
      AND role IN ('owner', 'admin')
  );
$$;

-- =========================================
-- handle_new_user: profile + workspace + 7 stages
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.workspaces (name, owner_id)
  VALUES ('Workspace de ' || NEW.email, NEW.id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  INSERT INTO public.stages (workspace_id, name, position, required_fields, is_default) VALUES
    (v_workspace_id, 'Base',                1, ARRAY[]::TEXT[],                                  true),
    (v_workspace_id, 'Lead Mapeado',        2, ARRAY['name','company','phone','role']::TEXT[],   true),
    (v_workspace_id, 'Tentando Contato',    3, ARRAY['name','company']::TEXT[],                  true),
    (v_workspace_id, 'Conexão Iniciada',    4, ARRAY['name','company']::TEXT[],                  true),
    (v_workspace_id, 'Desqualificado',      5, ARRAY[]::TEXT[],                                  true),
    (v_workspace_id, 'Qualificado',         6, ARRAY['name','company','email']::TEXT[],          true),
    (v_workspace_id, 'Reunião Agendada',    7, ARRAY['name','company','email']::TEXT[],          true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- validate_lead_for_stage RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.validate_lead_for_stage(p_lead_id UUID, p_target_stage_id UUID)
RETURNS TABLE (is_valid BOOLEAN, missing_fields TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_required TEXT[];
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_field TEXT;
  v_val TEXT;
  v_cf RECORD;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['lead_not_found']::TEXT[];
    RETURN;
  END IF;

  SELECT required_fields INTO v_required FROM public.stages WHERE id = p_target_stage_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['stage_not_found']::TEXT[];
    RETURN;
  END IF;

  FOREACH v_field IN ARRAY COALESCE(v_required, ARRAY[]::TEXT[]) LOOP
    v_val := NULL;
    CASE v_field
      WHEN 'name'    THEN v_val := v_lead.name;
      WHEN 'email'   THEN v_val := v_lead.email;
      WHEN 'phone'   THEN v_val := v_lead.phone;
      WHEN 'company' THEN v_val := v_lead.company;
      WHEN 'role'    THEN v_val := v_lead.role;
      WHEN 'source'  THEN v_val := v_lead.source;
      WHEN 'notes'   THEN v_val := v_lead.notes;
      ELSE v_val := v_lead.custom_data->>v_field;
    END CASE;
    IF v_val IS NULL OR length(trim(v_val)) = 0 THEN
      v_missing := array_append(v_missing, v_field);
    END IF;
  END LOOP;

  FOR v_cf IN
    SELECT key FROM public.custom_fields
    WHERE workspace_id = v_lead.workspace_id AND is_required = true
  LOOP
    v_val := v_lead.custom_data->>v_cf.key;
    IF (v_val IS NULL OR length(trim(v_val)) = 0) AND NOT (v_cf.key = ANY(v_missing)) THEN
      v_missing := array_append(v_missing, v_cf.key);
    END IF;
  END LOOP;

  RETURN QUERY SELECT (array_length(v_missing, 1) IS NULL), v_missing;
END;
$$;

-- =========================================
-- enforce_stage_required_fields trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.enforce_stage_required_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_required TEXT[];
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_field TEXT;
  v_val TEXT;
  v_cf RECORD;
BEGIN
  IF NEW.stage_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT required_fields INTO v_required FROM public.stages WHERE id = NEW.stage_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  FOREACH v_field IN ARRAY COALESCE(v_required, ARRAY[]::TEXT[]) LOOP
    v_val := NULL;
    CASE v_field
      WHEN 'name'    THEN v_val := NEW.name;
      WHEN 'email'   THEN v_val := NEW.email;
      WHEN 'phone'   THEN v_val := NEW.phone;
      WHEN 'company' THEN v_val := NEW.company;
      WHEN 'role'    THEN v_val := NEW.role;
      WHEN 'source'  THEN v_val := NEW.source;
      WHEN 'notes'   THEN v_val := NEW.notes;
      ELSE v_val := NEW.custom_data->>v_field;
    END CASE;
    IF v_val IS NULL OR length(trim(v_val)) = 0 THEN
      v_missing := array_append(v_missing, v_field);
    END IF;
  END LOOP;

  FOR v_cf IN
    SELECT key FROM public.custom_fields
    WHERE workspace_id = NEW.workspace_id AND is_required = true
  LOOP
    v_val := NEW.custom_data->>v_cf.key;
    IF (v_val IS NULL OR length(trim(v_val)) = 0) AND NOT (v_cf.key = ANY(v_missing)) THEN
      v_missing := array_append(v_missing, v_cf.key);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'missing required fields for stage: %', array_to_string(v_missing, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_enforce_stage
BEFORE INSERT OR UPDATE OF stage_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_stage_required_fields();

-- =========================================
-- notify_stage_trigger: fires generate-messages edge fn
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_stage_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_campaign RECORD;
  v_url TEXT;
  v_key TEXT;
BEGIN
  IF NEW.stage_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);
  IF v_url IS NULL OR v_key IS NULL THEN RETURN NEW; END IF;

  FOR v_campaign IN
    SELECT id FROM public.campaigns
    WHERE workspace_id = NEW.workspace_id
      AND trigger_stage_id = NEW.stage_id
      AND is_active = true
  LOOP
    PERFORM extensions.http_post(
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
$$;

CREATE TRIGGER trg_leads_notify_stage
AFTER INSERT OR UPDATE OF stage_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.notify_stage_trigger();

-- =========================================
-- move_lead_to_stage_by_name RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.move_lead_to_stage_by_name(_lead_id UUID, _stage_name TEXT)
RETURNS public.leads LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ws UUID;
  v_stage UUID;
  v_lead public.leads;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead not found'; END IF;

  IF NOT public.is_workspace_member(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id INTO v_stage FROM public.stages
  WHERE workspace_id = v_ws AND name = _stage_name LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'stage not found: %', _stage_name; END IF;

  UPDATE public.leads SET stage_id = v_stage WHERE id = _lead_id RETURNING * INTO v_lead;
  RETURN v_lead;
END;
$$;

-- =========================================
-- ENABLE RLS
-- =========================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log      ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLICIES
-- =========================================

-- profiles
CREATE POLICY "profiles_select_self_or_shared_ws" ON public.profiles
FOR SELECT TO authenticated USING (
  id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.workspace_members m1
    JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  )
);
CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- workspaces
CREATE POLICY "workspaces_select_member" ON public.workspaces
FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "workspaces_insert_owner" ON public.workspaces
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces_update_admin" ON public.workspaces
FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), id));
CREATE POLICY "workspaces_delete_owner" ON public.workspaces
FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- workspace_members
CREATE POLICY "wm_select_self_or_member" ON public.workspace_members
FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.is_workspace_member(auth.uid(), workspace_id)
);
CREATE POLICY "wm_insert_admin" ON public.workspace_members
FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin(auth.uid(), workspace_id)
);
CREATE POLICY "wm_update_admin" ON public.workspace_members
FOR UPDATE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "wm_delete_admin" ON public.workspace_members
FOR DELETE TO authenticated USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- generic tenant policy macro (stages, custom_fields, leads, campaigns, lead_messages, activity_log)
CREATE POLICY "stages_all_member" ON public.stages
FOR ALL TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "custom_fields_all_member" ON public.custom_fields
FOR ALL TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "leads_all_member" ON public.leads
FOR ALL TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "campaigns_all_member" ON public.campaigns
FOR ALL TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "lead_messages_all_member" ON public.lead_messages
FOR ALL TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "activity_log_select_member" ON public.activity_log
FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "activity_log_insert_member" ON public.activity_log
FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
