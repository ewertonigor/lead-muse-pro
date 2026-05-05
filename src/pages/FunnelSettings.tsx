import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StageEditSheet, Stage, CustomFieldOption } from "@/components/funnel/StageEditSheet";

const STANDARD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  company: "Empresa",
  role: "Cargo",
  source: "Origem",
  notes: "Observações",
};

const SortableRow = ({
  stage,
  onEdit,
  fieldLabels,
}: {
  stage: Stage;
  onEdit: (s: Stage) => void;
  fieldLabels: Record<string, string>;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const required = stage.required_fields ?? [];
  const labelFor = (k: string) => fieldLabels[k] ?? STANDARD_LABELS[k] ?? k;
  return (
    <Card ref={setNodeRef} style={style} className="flex items-center gap-3 p-3">
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">#{stage.position}</span>
          <span className="font-medium truncate">{stage.name}</span>
          {stage.is_default && (
            <Badge variant="secondary" className="text-xs">padrão</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {required.length === 0
            ? "Sem campos obrigatórios"
            : `${required.length} obrigatório${required.length > 1 ? "s" : ""}: ${required.map(labelFor).join(", ")}`}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onEdit(stage)} className="gap-1">
        <Pencil className="h-4 w-4" />
        Editar
      </Button>
    </Card>
  );
};

export default function FunnelSettings() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState<CustomFieldOption[]>([]);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    document.title = "Etapas do funil · Mini CRM SDR";
  }, []);

  const loadAll = async (initial = false) => {
    if (!workspace) return;
    if (initial) setLoading(true);
    const [{ data: stageRows }, { data: cfRows }] = await Promise.all([
      supabase
        .from("stages")
        .select("id, workspace_id, name, position, required_fields, is_default")
        .eq("workspace_id", workspace.id)
        .order("position", { ascending: true }),
      supabase
        .from("custom_fields")
        .select("key, label")
        .eq("workspace_id", workspace.id)
        .order("position", { ascending: true }),
    ]);
    setStages((stageRows ?? []) as Stage[]);
    setCustomFields((cfRows ?? []) as CustomFieldOption[]);
    if (initial) setLoading(false);
  };

  useEffect(() => {
    if (workspace) loadAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const stageIds = useMemo(() => stages.map((s) => s.id), [stages]);
  const customLabelMap = useMemo(
    () => Object.fromEntries(customFields.map((f) => [f.key, f.label])),
    [customFields],
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspace) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({
      ...s,
      position: i + 1,
    }));
    setStages(reordered);
    const { error } = await supabase.rpc("reorder_stages", {
      p_workspace_id: workspace.id,
      p_stage_ids: reordered.map((s) => s.id),
    });
    if (error) {
      toast.error("Não foi possível reordenar", { description: error.message });
      loadAll();
      return;
    }
    toast.success("Ordem atualizada");
  };

  const handleEdit = (s: Stage) => {
    setEditing(s);
    setSheetOpen(true);
  };

  if (wsLoading || loading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Etapas do funil</h1>
        <p className="text-sm text-muted-foreground">
          Configure as etapas do seu pipeline de vendas. Os campos obrigatórios são validados antes de um lead entrar em uma etapa.
        </p>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stageIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {stages.map((s) => (
              <SortableRow key={s.id} stage={s} onEdit={handleEdit} fieldLabels={customLabelMap} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <StageEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        stage={editing}
        customFields={customFields}
        onSaved={loadAll}
      />
    </div>
  );
}