import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WorkspaceMember = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async (): Promise<WorkspaceMember[]> => {
      if (!workspaceId) return [];
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (members ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
      }));
    },
    enabled: !!workspaceId,
  });
}