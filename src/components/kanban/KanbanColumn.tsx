import { Link } from "react-router-dom";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LeadCard } from "./LeadCard";
import type { Stage } from "@/hooks/useStages";
import type { Lead } from "@/hooks/useLeads";
import type { CustomField } from "@/hooks/useCustomFields";
import type { WorkspaceMember } from "@/hooks/useWorkspaceMembers";

type Props = {
  stage: Stage;
  leads: Lead[];
  total: number;
  customFields: CustomField[];
  membersById: Map<string, WorkspaceMember>;
  messagesByLead: Map<string, number>;
};

export function KanbanColumn({ stage, leads, total, customFields, membersById, messagesByLead }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}`, data: { stageId: stage.id } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="truncate text-sm font-medium">{stage.name}</h3>
          <Badge variant="secondary" className="shrink-0">{total}</Badge>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2 min-h-[120px]">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Sem leads nesta etapa
            </p>
          ) : (
            leads.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                customFields={customFields}
                owner={l.owner_id ? membersById.get(l.owner_id) : undefined}
                messageCount={messagesByLead.get(l.id) ?? 0}
              />
            ))
          )}
        </SortableContext>
        {total > leads.length && (
          <p className="px-2 py-1 text-center text-[11px] text-muted-foreground">
            Mostrando {leads.length} de {total} —{" "}
            <Link to={`/?stage=${stage.id}`} className="underline">ver todos</Link>
          </p>
        )}
      </div>
      <div className="border-t p-2">
        <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-1 text-muted-foreground">
          <Link to={`/leads/new?stage=${stage.id}`}>
            <Plus className="h-4 w-4" /> Novo lead
          </Link>
        </Button>
      </div>
    </div>
  );
}