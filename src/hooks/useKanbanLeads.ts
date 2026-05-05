import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "./useLeads";

export type StageLeads = { stageId: string; leads: Lead[]; total: number };

export function useKanbanLeads(workspaceId: string | undefined, stageIds: string[]) {
  const queries = useQueries({
    queries: stageIds.map((stageId) => ({
      queryKey: ["kanban-leads", workspaceId, stageId],
      enabled: !!workspaceId,
      queryFn: async (): Promise<StageLeads> => {
        const { data, count, error } = await supabase
          .from("leads")
          .select("*", { count: "exact" })
          .eq("workspace_id", workspaceId!)
          .eq("stage_id", stageId)
          .order("updated_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return { stageId, leads: (data ?? []) as unknown as Lead[], total: count ?? 0 };
      },
    })),
  });
  return queries;
}

export function useLeadsWithMessages(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["leads-with-messages", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("lead_messages")
        .select("lead_id")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return new Set((data ?? []).map((r: { lead_id: string }) => r.lead_id));
    },
  });
}