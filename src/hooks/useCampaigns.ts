import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Campaign = {
  id: string;
  workspace_id: string;
  name: string;
  context: string | null;
  prompt: string | null;
  trigger_stage_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useCampaigns(
  workspaceId: string | undefined,
  { activeOnly = false }: { activeOnly?: boolean } = {},
) {
  return useQuery({
    queryKey: ["campaigns", workspaceId, { activeOnly }],
    enabled: !!workspaceId,
    queryFn: async (): Promise<Campaign[]> => {
      let q = supabase
        .from("campaigns")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("updated_at", { ascending: false });
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ["campaign", id],
    enabled: !!id,
    queryFn: async (): Promise<Campaign | null> => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Campaign | null;
    },
  });
}

export type CampaignInput = {
  workspace_id: string;
  name: string;
  context: string;
  prompt: string;
  trigger_stage_id: string | null;
  is_active: boolean;
};

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignInput) => {
      const { data, error } = await supabase
        .from("campaigns")
        .insert(input as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Campaign;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["campaigns", c.workspace_id] });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CampaignInput> }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update(patch as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Campaign;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["campaigns", c.workspace_id] });
      qc.invalidateQueries({ queryKey: ["campaign", c.id] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
      return { id, workspaceId };
    },
    onSuccess: ({ workspaceId, id }) => {
      qc.invalidateQueries({ queryKey: ["campaigns", workspaceId] });
      qc.removeQueries({ queryKey: ["campaign", id] });
    },
  });
}

export function useCampaignStats(id: string | undefined) {
  return useQuery({
    queryKey: ["campaign-stats", id],
    enabled: !!id,
    queryFn: async () => {
      const [{ count: total }, { count: sent }, { data: msgs }] = await Promise.all([
        supabase
          .from("lead_messages")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", id!),
        supabase
          .from("lead_messages")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", id!)
          .not("sent_at", "is", null),
        supabase.from("lead_messages").select("lead_id").eq("campaign_id", id!),
      ]);
      const counts = new Map<string, number>();
      for (const r of msgs ?? []) {
        const k = (r as { lead_id: string }).lead_id;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const topLeadIds = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      let topLeads: { id: string; name: string | null; company: string | null; count: number }[] = [];
      if (topLeadIds.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, name, company")
          .in(
            "id",
            topLeadIds.map(([lid]) => lid),
          );
        topLeads = topLeadIds.map(([lid, count]) => {
          const l = leads?.find((x) => x.id === lid);
          return { id: lid, name: l?.name ?? null, company: l?.company ?? null, count };
        });
      }
      return { total: total ?? 0, sent: sent ?? 0, topLeads };
    },
  });
}
