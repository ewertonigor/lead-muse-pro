import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStages } from "@/hooks/useStages";
import {
  useCampaigns,
  useDeleteCampaign,
  useUpdateCampaign,
  Campaign,
} from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignForm } from "@/components/campaigns/CampaignForm";

export default function Campaigns() {
  const { workspace } = useWorkspace();
  const { data: campaigns = [], isLoading } = useCampaigns(workspace?.id);
  const { data: stages = [] } = useStages(workspace?.id);
  const updateMut = useUpdateCampaign();
  const deleteMut = useDeleteCampaign();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);

  useEffect(() => {
    document.title = "Campanhas · SDR.ai";
  }, []);

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);

  const toggleActive = async (c: Campaign) => {
    try {
      await updateMut.mutateAsync({ id: c.id, patch: { is_active: !c.is_active } });
      toast.success(c.is_active ? "Campanha desativada" : "Campanha ativada");
    } catch (err) {
      toast.error("Falha ao alterar status", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const onDelete = async () => {
    if (!confirmDelete || !workspace) return;
    try {
      await deleteMut.mutateAsync({ id: confirmDelete.id, workspaceId: workspace.id });
      toast.success("Campanha removida");
      setConfirmDelete(null);
    } catch (err) {
      toast.error("Falha ao remover", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Defina contextos de outreach e a IA usa para gerar mensagens personalizadas para seus leads.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-muted-foreground">Nenhuma campanha criada ainda.</p>
          <Button onClick={() => setCreateOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Criar primeira campanha
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    <Link to={`/campaigns/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </CardTitle>
                  <Badge variant={c.is_active ? "default" : "secondary"}>
                    {c.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                {c.context && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {c.context.slice(0, 120)}
                    {c.context.length > 120 ? "…" : ""}
                  </p>
                )}
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-0">
                <div className="flex flex-wrap gap-1">
                  {c.trigger_stage_id && (
                    <Badge variant="outline" className="text-xs">
                      Auto: {stageMap.get(c.trigger_stage_id) ?? "—"}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button asChild size="sm" variant="ghost" className="gap-1">
                    <Link to={`/campaigns/${c.id}`}><Pencil className="h-3.5 w-3.5" /> Editar</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => toggleActive(c)}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {c.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
          </DialogHeader>
          <CampaignForm
            mode="create"
            onSaved={() => setCreateOpen(false)}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a campanha "{confirmDelete?.name}" e todas as mensagens
              geradas associadas. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
