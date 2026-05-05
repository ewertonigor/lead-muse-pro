import { useNavigate } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Lead } from "@/hooks/useLeads";
import type { CustomField } from "@/hooks/useCustomFields";
import type { WorkspaceMember } from "@/hooks/useWorkspaceMembers";

type Props = {
  lead: Lead;
  hasMessages?: boolean;
  customFields: CustomField[];
  owner?: WorkspaceMember;
};

export function LeadCard({ lead, hasMessages, customFields, owner }: Props) {
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

  const ownerInitials = (owner?.full_name || owner?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
        {owner && (
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px]">{ownerInitials}</AvatarFallback>
          </Avatar>
        )}
      </div>
      {(interesting.length > 0 || hasMessages) && (
        <div className="flex flex-wrap items-center gap-1">
          {interesting.map((cf) => (
            <Badge key={cf.id} variant="secondary" className="hidden sm:inline-flex max-w-[140px] truncate text-[10px] font-normal">
              {cf.label}: {String(cd[cf.key])}
            </Badge>
          ))}
          {hasMessages && (
            <span className="inline-flex items-center gap-1 text-muted-foreground" title="Tem mensagens geradas">
              <MessageSquare className="h-3 w-3" />
            </span>
          )}
        </div>
      )}
    </Card>
  );
}