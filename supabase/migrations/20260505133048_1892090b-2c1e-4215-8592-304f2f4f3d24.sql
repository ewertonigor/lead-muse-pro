
CREATE OR REPLACE FUNCTION public.reorder_stages(
  p_workspace_id UUID,
  p_stage_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INT;
BEGIN
  IF NOT public.is_workspace_admin(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR i IN 1..array_length(p_stage_ids, 1) LOOP
    UPDATE public.stages
    SET position = i, updated_at = now()
    WHERE id = p_stage_ids[i] AND workspace_id = p_workspace_id;
  END LOOP;
END;
$$;
