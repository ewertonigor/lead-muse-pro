import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCustomFields, CustomField } from "@/hooks/useCustomFields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomFieldDialog } from "@/components/custom-fields/CustomFieldDialog";

const TYPE_BADGE: Record<CustomField["field_type"], { label: string; className: string }> = {
  text:    { label: "Texto",   className: "bg-muted text-foreground" },
  number:  { label: "Número",  className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  date:    { label: "Data",    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  boolean: { label: "Sim/Não", className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  select:  { label: "Seleção", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

export default function CustomFields() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useCustomFields(workspace?.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [toDelete, setToDelete] = useState<CustomField | null>(null);

  useEffect(() => {
    document.title = "Campos personalizados · SDR.ai";
  }, []);

  const nextPosition = useMemo(
    () => (fields.length ? Math.max(...fields.map((f) => f.position)) + 1 : 0),
    [fields],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["custom-fields", workspace?.id] });

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const handleEdit = (f: CustomField) => {
    setEditing(f);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("custom_fields").delete().eq("id", toDelete.id);
    if (error) {
      toast.error("Não foi possível excluir", { description: error.message });
      return;
    }
    toast.success("Campo excluído");
    setToDelete(null);
    refresh();
  };

  if (wsLoading || isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Campos personalizados</h1>
          <p className="text-sm text-muted-foreground">
            Adicione campos específicos do seu negócio. Eles se aplicam a todos os leads deste workspace.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" /> Novo campo
        </Button>
      </header>

      {fields.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-muted-foreground">
            Nenhum campo personalizado ainda.
          </p>
          <Button onClick={handleNew} className="gap-1">
            <Plus className="h-4 w-4" /> Adicionar campo
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rótulo</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => {
                const badge = TYPE_BADGE[f.field_type];
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{f.key}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>{f.is_required ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(f)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(f)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {workspace && (
        <CustomFieldDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspaceId={workspace.id}
          field={editing}
          nextPosition={nextPosition}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo personalizado?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{toDelete?.label}</strong> remove o campo dos formulários e do gerador de mensagens.
              Os valores existentes nos leads permanecem armazenados, mas não serão mais exibidos.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}