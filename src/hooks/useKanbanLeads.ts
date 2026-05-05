import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "./useLeads";

export type StageLeads = { stageId: string; leads: Lead[]; total: number };

export type KanbanFilters = {
  search?: string;
  ownerIds?: string[]; // include "__unassigned__" to filter unassigned
};

const UNASSIGNED = "__unassigned__";

export function useKanbanLeads(
  workspaceId: string | undefined,
  stageIds: string[],
  filters: KanbanFilters = {},
) {
  const search = filters.search?.trim() ?? "";
  const ownerIds = filters.ownerIds ?? [];
  const queries = useQueries({
    queries: stageIds.map((stageId) => ({
      queryKey: ["kanban-leads", workspaceId, stageId, { search, ownerIds }],
      enabled: !!workspaceId,
      queryFn: async (): Promise<StageLeads> => {
        let q = supabase
          .from("leads")
          .select("*", { count: "exact" })
          .eq("workspace_id", workspaceId!)
          .eq("stage_id", stageId)
          .order("updated_at", { ascending: false })
          .limit(50);
        if (search.length > 0) {
          const like = `%${search.replace(/[%,]/g, " ")}%`;
          q = q.or(`name.ilike.${like},company.ilike.${like}`);
        }
        if (ownerIds.length > 0) {
          const ids = ownerIds.filter((o) => o !== UNASSIGNED);
          const includeUnassigned = ownerIds.includes(UNASSIGNED);
          if (includeUnassigned && ids.length > 0) {
            q = q.or(`owner_id.is.null,owner_id.in.(${ids.join(",")})`);
          } else if (includeUnassigned) {
            q = q.is("owner_id", null);
          } else {
            q = q.in("owner_id", ids);
          }
        }
        const { data, count, error } = await q;
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
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("lead_messages")
        .select("lead_id")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { lead_id: string }[]) {
        m.set(r.lead_id, (m.get(r.lead_id) ?? 0) + 1);
      }
      return m;
    },
  });
}