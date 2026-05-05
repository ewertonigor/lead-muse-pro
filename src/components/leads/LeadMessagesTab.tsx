import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Send, Sparkles, RefreshCw, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Variation = { subject: string | null; body: string; tone: string };
type LeadMessage = {
  id: string;
  workspace_id: string;
  lead_id: string;
  campaign_id: string | null;
  variations: Variation[];
  sent_at: string | null;
  created_at: string;
};

type ActivityRow = {
  payload: { campaign_id?: string; trigger_source?: string } | null;
};

export function LeadMessagesTab({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const { data: campaigns = [] } = useCampaigns(workspace?.id, { activeOnly: true });
  const [campaignId, setCampaignId] = useState<string>("");
  const [showOlder, setShowOlder] = useState(false);

  useEffect(() => {
    if (!campaignId && campaigns.length > 0) setCampaignId(campaigns[0].id);
  }, [campaigns, campaignId]);

  const { data: autoCampaigns } = useQuery({
    queryKey: ["lead-auto-campaigns", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("payload")
        .eq("lead_id", leadId)
        .eq("action", "message_generated");
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as ActivityRow[]) {
        if (r.payload?.trigger_source === "auto_stage_trigger" && r.payload?.campaign_id) {
          set.add(r.payload.campaign_id);
        }
      }
      return set;
    },
  });

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`lead-messages:${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_messages", filter: `lead_id=eq.${leadId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["lead-messages", leadId] });
          qc.invalidateQueries({ queryKey: ["lead-auto-campaigns", leadId] });
          qc.invalidateQueries({ queryKey: ["leads-with-messages", workspace?.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, qc, workspace?.id]);

  const messagesQuery = useQuery({
    queryKey: ["lead-messages", leadId, campaignId],
    enabled: !!leadId && !!campaignId,
    queryFn: async (): Promise<LeadMessage[]> => {
      const { data, error } = await supabase
        .from("lead_messages")
        .select("*")
        .eq("lead_id", leadId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadMessage[];
    },
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-messages", {
        body: { lead_id: leadId, campaign_id: campaignId, trigger_source: "manual" },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Mensagens geradas");
      qc.invalidateQueries({ queryKey: ["lead-messages", leadId, campaignId] });
      qc.invalidateQueries({ queryKey: ["leads-with-messages", workspace?.id] });
    },
    onError: (err) => {
      toast.error("Falha ao gerar mensagens", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const messages = messagesQuery.data ?? [];
  const latest = messages[0];
  const older = messages.slice(1);

  const copy = async (v: Variation) => {
    const text = v.subject ? `${v.subject}\n\n${v.body}` : v.body;
    await navigator.clipboard.writeText(text);
  };

  const sendMut = useMutation({
    mutationFn: async ({ message, idx }: { message: LeadMessage; idx: number }) => {
      const v = message.variations[idx];
      await copy(v);

      const { error: upErr } = await supabase
        .from("lead_messages")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", message.id);
      if (upErr) throw upErr;

      const { error: rpcErr } = await supabase.rpc("move_lead_to_stage_by_name", {
        _lead_id: leadId,
        _stage_name: "Tentando Contato",
      });
      if (rpcErr) throw rpcErr;

      if (workspace) {
        await supabase.from("activity_log").insert({
          workspace_id: workspace.id,
          lead_id: leadId,
          action: "message_sent",
          payload: { campaign_id: message.campaign_id, variation_index: idx },
        });
      }
    },
    onSuccess: () => {
      toast.success("Mensagem copiada", {
        description: "Lead movido para 'Tentando Contato'.",
      });
      qc.invalidateQueries({ queryKey: ["lead-messages", leadId, campaignId] });
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["kanban-leads", workspace?.id] });
    },
    onError: (err) => {
      toast.error("Falha ao enviar", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  if (campaigns.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nenhuma campanha ativa. Crie uma campanha primeiro em Campanhas.
      </Card>
    );
  }

  const isAuto = !!campaignId && !!autoCampaigns?.has(campaignId);
  const currentCampaignName = campaigns.find((c) => c.id === campaignId)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs text-muted-foreground">Campanha</label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{autoCampaigns?.has(c.id) ? " ⚡" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => generateMut.mutate()}
          disabled={!campaignId || generateMut.isPending}
          className="gap-1"
        >
          <Sparkles className="h-4 w-4" />
          {generateMut.isPending ? "Gerando..." : "Gerar"}
        </Button>
        {latest && (
          <Button
            variant="outline"
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" /> Regenerar
          </Button>
        )}
      </div>

      {isAuto && (
        <Card className="flex items-start gap-2 border-primary/30 bg-primary/5 p-3 text-sm">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Mensagens geradas automaticamente pela campanha{" "}
            <strong>{currentCampaignName}</strong> quando este lead entrou na etapa-gatilho.
          </p>
        </Card>
      )}

      {generateMut.isPending && (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!generateMut.isPending && messagesQuery.isLoading && (
        <Skeleton className="h-32 w-full" />
      )}

      {!generateMut.isPending && !messagesQuery.isLoading && !latest && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhuma mensagem gerada ainda. Clique em "Gerar".
        </Card>
      )}

      {latest && (
        <MessageBlock
          message={latest}
          onCopy={async (idx) => { await copy(latest.variations[idx]); toast.success("Copiado"); }}
          onSend={(idx) => sendMut.mutate({ message: latest, idx })}
          sending={sendMut.isPending}
          highlightLatest
        />
      )}

      {older.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOlder((s) => !s)}
            className="gap-1"
          >
            {showOlder ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showOlder ? "Ocultar" : `Ver gerações anteriores (${older.length})`}
          </Button>
          {showOlder &&
            older.map((m) => (
              <MessageBlock
                key={m.id}
                message={m}
                onCopy={async (idx) => { await copy(m.variations[idx]); toast.success("Copiado"); }}
                onSend={(idx) => sendMut.mutate({ message: m, idx })}
                sending={sendMut.isPending}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function MessageBlock({
  message,
  onCopy,
  onSend,
  sending,
  highlightLatest,
}: {
  message: LeadMessage;
  onCopy: (idx: number) => void;
  onSend: (idx: number) => void;
  sending: boolean;
  highlightLatest?: boolean;
}) {
  const date = useMemo(
    () => new Date(message.created_at).toLocaleString("pt-BR"),
    [message.created_at],
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {highlightLatest ? "Última geração" : "Geração"} · {date}
        </span>
        {message.sent_at && (
          <Badge variant="outline" className="text-[10px]">
            Enviada em {new Date(message.sent_at).toLocaleString("pt-BR")}
          </Badge>
        )}
      </div>
      <div className="grid gap-3">
        {message.variations.map((v, idx) => (
          <Card key={idx} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="text-[10px]">{v.tone}</Badge>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => onCopy(idx)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => onSend(idx)}
                  disabled={sending}
                >
                  <Send className="h-3.5 w-3.5" /> Enviar
                </Button>
              </div>
            </div>
            {v.subject && <p className="text-sm font-semibold">{v.subject}</p>}
            <p className="whitespace-pre-wrap text-sm">{v.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
