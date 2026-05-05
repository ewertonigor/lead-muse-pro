import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStages } from "@/hooks/useStages";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useKanbanLeads, useLeadsWithMessages } from "@/hooks/useKanbanLeads";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { LeadCard } from "@/components/kanban/LeadCard";
import { FilterBar } from "@/components/kanban/FilterBar";
import type { Lead } from "@/hooks/useLeads";

const STANDARD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  company: "Empresa",
  role: "Cargo",
  source: "Origem",
  notes: "Observações",
};

const Index = () => {
  const qc = useQueryClient();
  const { workspace, loading: wsLoading } = useWorkspace();
  const { data: stages = [], isLoading: stagesLoading } = useStages(workspace?.id);
  const { data: customFields = [] } = useCustomFields(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const { data: messageLeadIds } = useLeadsWithMessages(workspace?.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const ownerFilter = useMemo(
    () => (searchParams.get("owner") ?? "").split(",").filter(Boolean),
    [searchParams],
  );
  const stageFilter = useMemo(
    () => (searchParams.get("stage") ?? "").split(",").filter(Boolean),
    [searchParams],
  );

  const visibleStages = useMemo(
    () => (stageFilter.length > 0 ? stages.filter((s) => stageFilter.includes(s.id)) : stages),
    [stages, stageFilter],
  );
  const stageIds = useMemo(() => visibleStages.map((s) => s.id), [visibleStages]);
  const stageQueries = useKanbanLeads(workspace?.id, stageIds, {
    search,
    ownerIds: ownerFilter,
  });

  const updateParam = (key: string, value: string | string[] | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const v = Array.isArray(value) ? value.join(",") : value;
      if (!v) next.delete(key);
      else next.set(key, v);
      return next;
    });
  };

  const hasFilters =
    search.length > 0 || ownerFilter.length > 0 || stageFilter.length > 0;

  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    document.title = "Kanban · Mini CRM SDR";
  }, []);

  // Realtime sync
  useEffect(() => {
    if (!workspace?.id) return;
    const channel = supabase
      .channel(`leads:${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `workspace_id=eq.${workspace.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["kanban-leads", workspace.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace?.id, qc]);

  const membersById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, { leads: Lead[]; total: number }>();
    stageQueries.forEach((q, idx) => {
      const sid = stageIds[idx];
      if (q.data) map.set(sid, { leads: q.data.leads, total: q.data.total });
      else map.set(sid, { leads: [], total: 0 });
    });
    return map;
  }, [stageQueries, stageIds]);

  const allLeads = useMemo(() => {
    const out: Lead[] = [];
    for (const [, v] of leadsByStage) out.push(...v.leads);
    return out;
  }, [leadsByStage]);

  const totalLeads = useMemo(
    () => Array.from(leadsByStage.values()).reduce((acc, v) => acc + v.total, 0),
    [leadsByStage],
  );

  const labelFor = (key: string) => {
    const cf = customFields.find((c) => c.key === key);
    return cf?.label ?? STANDARD_LABELS[key] ?? key;
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string;
    const lead = allLeads.find((l) => l.id === id);
    setActiveLead(lead ?? null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveLead(null);
    if (!over || !workspace) return;
    const lead = allLeads.find((l) => l.id === active.id);
    if (!lead) return;

    // determine target stage from over data (column or card)
    const overData = over.data.current as { stageId?: string } | undefined;
    const targetStageId = overData?.stageId;
    if (!targetStageId || targetStageId === lead.stage_id) return;

    const sourceStageId = lead.stage_id;
    const filterKey = { search, ownerIds: ownerFilter };
    const sourceKey = ["kanban-leads", workspace.id, sourceStageId, filterKey];
    const targetKey = ["kanban-leads", workspace.id, targetStageId, filterKey];

    // Optimistic update
    const prevSource = qc.getQueryData(sourceKey);
    const prevTarget = qc.getQueryData(targetKey);
    qc.setQueryData(sourceKey, (old: { leads: Lead[]; total: number; stageId: string } | undefined) =>
      old ? { ...old, leads: old.leads.filter((l) => l.id !== lead.id), total: Math.max(0, old.total - 1) } : old,
    );
    qc.setQueryData(targetKey, (old: { leads: Lead[]; total: number; stageId: string } | undefined) =>
      old
        ? { ...old, leads: [{ ...lead, stage_id: targetStageId }, ...old.leads], total: old.total + 1 }
        : old,
    );

    try {
      const { data: vres, error: vErr } = await supabase.rpc("validate_lead_for_stage", {
        p_lead_id: lead.id,
        p_target_stage_id: targetStageId,
      });
      if (vErr) throw vErr;
      const row = Array.isArray(vres) ? vres[0] : vres;
      if (row && row.is_valid === false) {
        const missing: string[] = row.missing_fields ?? [];
        qc.setQueryData(sourceKey, prevSource);
        qc.setQueryData(targetKey, prevTarget);
        toast.error("Não foi possível mover o lead", {
          description: `Campos faltando: ${missing.map(labelFor).join(", ")}`,
          action: { label: "Editar", onClick: () => (window.location.href = `/leads/${lead.id}`) },
        });
        return;
      }

      const { error } = await supabase
        .from("leads")
        .update({ stage_id: targetStageId })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead movido");
      try {
        await supabase.from("activity_log").insert({
          workspace_id: workspace.id,
          lead_id: lead.id,
          action: "lead_stage_changed",
          payload: { from_stage_id: sourceStageId, to_stage_id: targetStageId } as never,
        });
      } catch {
        // best-effort
      }
    } catch (err) {
      qc.setQueryData(sourceKey, prevSource);
      qc.setQueryData(targetKey, prevTarget);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Falha ao mover lead", { description: msg });
    } finally {
      qc.invalidateQueries({ queryKey: sourceKey });
      qc.invalidateQueries({ queryKey: targetKey });
    }
  };

  if (wsLoading || stagesLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Kanban</h1>
          <p className="text-sm text-muted-foreground">
            Arraste leads entre etapas. Campos obrigatórios são validados automaticamente.
          </p>
        </div>
        <Button asChild className="gap-1 shrink-0">
          <Link to="/leads/new"><Plus className="h-4 w-4" /> Novo lead</Link>
        </Button>
      </header>

      <FilterBar
        search={search}
        onSearchChange={(v) => updateParam("q", v)}
        stages={stages}
        selectedStages={stageFilter}
        onStagesChange={(v) => updateParam("stage", v)}
        members={members}
        selectedOwners={ownerFilter}
        onOwnersChange={(v) => updateParam("owner", v)}
        onClear={() => setSearchParams(new URLSearchParams())}
        hasFilters={hasFilters}
      />

      {totalLeads === 0 ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-muted-foreground">
            {hasFilters ? "Nenhum lead corresponde aos filtros." : "Nenhum lead ainda."}
          </p>
          <Button asChild className="gap-1">
            <Link to="/leads/new"><Plus className="h-4 w-4" /> Criar primeiro lead</Link>
          </Button>
        </Card>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
            {visibleStages.map((s) => {
              const bucket = leadsByStage.get(s.id) ?? { leads: [], total: 0 };
              return (
                <KanbanColumn
                  key={s.id}
                  stage={s}
                  leads={bucket.leads}
                  total={bucket.total}
                  customFields={customFields}
                  membersById={membersById}
                  messagesByLead={messageLeadIds ?? new Set()}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeLead && (
              <LeadCard
                lead={activeLead}
                customFields={customFields}
                owner={activeLead.owner_id ? membersById.get(activeLead.owner_id) : undefined}
                hasMessages={messageLeadIds?.has(activeLead.id)}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default Index;
