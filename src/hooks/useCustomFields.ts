import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustomField = {
  id: string;
  workspace_id: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select";
  options: { value: string; label: string }[];
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export const RESERVED_KEYS = [
  "name", "email", "phone", "company", "role", "source", "notes",
  "id", "workspace_id", "stage_id", "owner_id",
  "created_at", "updated_at", "custom_data",
];

export const KEY_REGEX = /^[a-z][a-z0-9_]{1,40}$/;

export function useCustomFields(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["custom-fields", workspaceId],
    queryFn: async (): Promise<CustomField[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CustomField[];
    },
    enabled: !!workspaceId,
  });
}