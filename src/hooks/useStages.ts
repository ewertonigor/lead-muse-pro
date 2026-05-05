import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Stage = {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  required_fields: string[];
  is_default: boolean;
};

export function useStages(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["stages", workspaceId],
    queryFn: async (): Promise<Stage[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("stages")
        .select("id, workspace_id, name, position, required_fields, is_default")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Stage[];
    },
    enabled: !!workspaceId,
  });
}