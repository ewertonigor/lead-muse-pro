import { useNavigate } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import type { Lead } from "@/hooks/useLeads";
import type { CustomField } from "@/hooks/useCustomFields";
import type { WorkspaceMember } from "@/hooks/useWorkspaceMembers";

type Props = {
  lead: Lead;
  messageCount?: number;
  customFields: CustomField[];
  owner?: WorkspaceMember;
};

export function LeadCard({ lead, messageCount = 0, customFields, owner }: Props) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id, data: { stageId: lead.stage_id } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const cd = (lead.custom_data ?? {}) as Record<string, unknown>;
  const interesting = customFields
    .filter((cf) => cd[cf.key] !== undefined && cd[cf.key] !== null && cd[cf.key] !== "")
    .slice(0, 2);

  const displayValue = (cf: CustomField, raw: unknown): string => {
    if (cf.field_type === "select") {
      const opt = cf.options.find((o) => o.value === raw);
      return opt?.label ?? String(raw);
    }
    if (cf.field_type === "boolean") return raw ? "Sim" : "Não";
    return String(raw);
  };

  const onClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    navigate(`/leads/${lead.id}`);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing space-y-2 p-3 hover:border-primary/40 transition-colors",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">
            {lead.name || "(sem nome)"}
          </p>
          {lead.company && (
            <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
          )}
        </div>
        {owner && <UserAvatar email={owner.email} name={owner.full_name} size={24} />}
      </div>
      {(interesting.length > 0 || messageCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex flex-wrap items-center gap-1">
            {interesting.map((cf) => (
              <Badge key={cf.id} variant="secondary" className="hidden sm:inline-flex max-w-[140px] truncate text-[10px] font-normal">
                {cf.label}: {displayValue(cf, cd[cf.key])}
              </Badge>
            ))}
          </div>
          {messageCount > 0 && (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              title={`${messageCount} mensagem(ns) gerada(s)`}
            >
              <Sparkles className="h-3 w-3" />
              {messageCount}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}