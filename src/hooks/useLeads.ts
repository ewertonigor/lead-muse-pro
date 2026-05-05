import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";

export type Lead = {
  id: string;
  workspace_id: string;
  owner_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  source: string | null;
  notes: string | null;
  stage_id: string | null;
  custom_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ListParams = {
  workspaceId: string | undefined;
  stageId?: string;
  ownerId?: string;
  search?: string;
};

export function useLeads({ workspaceId, stageId, ownerId, search }: ListParams) {
  return useQuery({
    queryKey: ["leads", workspaceId, { stageId, ownerId, search }],
    queryFn: async (): Promise<Lead[]> => {
      if (!workspaceId) return [];
      let q = supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (stageId) q = q.eq("stage_id", stageId);
      if (ownerId) q = q.eq("owner_id", ownerId);
      if (search && search.trim().length > 0) {
        const like = `%${search.trim()}%`;
        q = q.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
    enabled: !!workspaceId,
  });
}

export function useLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead", leadId],
    queryFn: async (): Promise<Lead | null> => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Lead | null;
    },
    enabled: !!leadId,
  });
}

export type LeadInput = {
  workspace_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  source: string | null;
  notes: string | null;
  stage_id: string;
  owner_id: string | null;
  custom_data: Record<string, unknown>;
};

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadInput) => {
      const { data, error } = await supabase
        .from("leads")
        .insert(input as never)
        .select()
        .single();
      if (error) throw error;
      const lead = data as unknown as Lead;
      await logActivity({
        workspaceId: lead.workspace_id,
        leadId: lead.id,
        action: "lead_created",
        payload: { stage_id: lead.stage_id },
      });
      return lead;
    },
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: ["leads", lead.workspace_id] });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LeadInput> }) => {
      const { data: prev } = await supabase
        .from("leads")
        .select("stage_id")
        .eq("id", id)
        .maybeSingle();
      const { data, error } = await supabase
        .from("leads")
        .update(patch as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const lead = data as unknown as Lead;
      const stageChanged =
        patch.stage_id !== undefined && prev?.stage_id !== lead.stage_id;
      if (stageChanged) {
        await logActivity({
          workspaceId: lead.workspace_id,
          leadId: lead.id,
          action: "lead_stage_changed",
          payload: { from_stage_id: prev?.stage_id ?? null, to_stage_id: lead.stage_id },
        });
      } else {
        await logActivity({
          workspaceId: lead.workspace_id,
          leadId: lead.id,
          action: "lead_updated",
        });
      }
      return lead;
    },
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: ["leads", lead.workspace_id] });
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      await logActivity({ workspaceId, leadId: id, action: "lead_deleted" });
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      return { id, workspaceId };
    },
    onSuccess: ({ workspaceId, id }) => {
      qc.invalidateQueries({ queryKey: ["leads", workspaceId] });
      qc.removeQueries({ queryKey: ["lead", id] });
    },
  });
}