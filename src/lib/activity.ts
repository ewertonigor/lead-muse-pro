import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "lead_created"
  | "lead_updated"
  | "lead_stage_changed"
  | "lead_deleted"
  | "message_generated"
  | "message_sent"
  | "campaign_created"
  | "campaign_updated";

export async function logActivity(args: {
  workspaceId: string;
  leadId?: string | null;
  action: ActivityAction;
  payload?: Record<string, unknown>;
}) {
  try {
    await supabase.from("activity_log").insert({
      workspace_id: args.workspaceId,
      lead_id: args.leadId ?? null,
      action: args.action,
      payload: args.payload ?? {},
    });
  } catch {
    // best-effort logging
  }
}
