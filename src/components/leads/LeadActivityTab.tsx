import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  Activity as ActivityIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStages } from "@/hooks/useStages";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ActivityRow = {
  id: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

const ICONS: Record<string, React.ElementType> = {
  lead_created: Plus,
  lead_updated: Pencil,
  lead_stage_changed: ArrowRight,
  lead_deleted: Trash2,
  message_generated: MessageSquare,
  message_sent: Send,
};

export function LeadActivityTab({ leadId }: { leadId: string }) {
  const { workspace } = useWorkspace();
  const { data: stages = [] } = useStages(workspace?.id);
  const { data: campaigns = [] } = useCampaigns(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);

  const { data, isLoading } = useQuery({
    queryKey: ["lead-activity", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, actor_id, created_at, payload")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ActivityRow[];
    },
  });

  const stageName = (id: unknown) =>
    (typeof id === "string" && stages.find((s) => s.id === id)?.name) || "—";
  const campaignName = (id: unknown) =>
    (typeof id === "string" && campaigns.find((c) => c.id === id)?.name) || "campanha";
  const actorName = (id: string | null) => {
    if (!id) return "Sistema";
    const m = members.find((mm) => mm.user_id === id);
    return m?.full_name || m?.email || "Usuário";
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nenhuma atividade registrada ainda.
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {data.map((a) => {
        const Icon = ICONS[a.action] ?? ActivityIcon;
        const actor = actorName(a.actor_id);
        const p = a.payload ?? {};
        let text: React.ReactNode;
        switch (a.action) {
          case "lead_created":
            text = <>Lead criado por <strong>{actor}</strong></>;
            break;
          case "lead_updated":
            text = <>Lead atualizado por <strong>{actor}</strong></>;
            break;
          case "lead_stage_changed":
            text = (
              <>
                Movido de <strong>{stageName(p.from_stage_id)}</strong> para{" "}
                <strong>{stageName(p.to_stage_id)}</strong> por <strong>{actor}</strong>
              </>
            );
            break;
          case "lead_deleted":
            text = <>Lead excluído por <strong>{actor}</strong></>;
            break;
          case "message_generated":
            text = (
              <>
                Mensagens geradas para a campanha{" "}
                <strong>{campaignName(p.campaign_id)}</strong>
                {p.trigger_source ? ` (${p.trigger_source})` : ""}
              </>
            );
            break;
          case "message_sent":
            text = (
              <>
                Mensagem enviada na campanha{" "}
                <strong>{campaignName(p.campaign_id)}</strong> por <strong>{actor}</strong>
              </>
            );
            break;
          default:
            text = a.action;
        }
        return (
          <div key={a.id} className="flex items-start gap-3 p-4">
            <div className="mt-0.5 rounded-full bg-muted p-2">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
