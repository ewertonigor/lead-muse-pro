import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Power, Trash2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStages } from "@/hooks/useStages";
import {
  useCampaign,
  useCampaignStats,
  useDeleteCampaign,
  useUpdateCampaign,
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

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { data: campaign, isLoading } = useCampaign(id);
  const { data: stages = [] } = useStages(workspace?.id);
  const { data: stats } = useCampaignStats(id);
  const updateMut = useUpdateCampaign();
  const deleteMut = useDeleteCampaign();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    document.title = campaign ? `${campaign.name} · Campanhas` : "Campanha";
  }, [campaign]);

  const stageName = useMemo(
    () => stages.find((s) => s.id === campaign?.trigger_stage_id)?.name,
    [stages, campaign],
  );

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!campaign) return <p className="text-muted-foreground">Campanha não encontrada.</p>;

  const toggleActive = async () => {
    try {
      await updateMut.mutateAsync({ id: campaign.id, patch: { is_active: !campaign.is_active } });
      toast.success(campaign.is_active ? "Campanha desativada" : "Campanha ativada");
    } catch (err) {
      toast.error("Falha ao alterar status", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const onDelete = async () => {
    if (!workspace) return;
    try {
      await deleteMut.mutateAsync({ id: campaign.id, workspaceId: workspace.id });
      toast.success("Campanha removida");
      navigate("/campaigns");
    } catch (err) {
      toast.error("Falha ao remover", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="gap-1 -ml-3">
            <Link to="/campaigns"><ArrowLeft className="h-4 w-4" /> Campanhas</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={campaign.is_active ? "default" : "secondary"}>
              {campaign.is_active ? "Ativa" : "Inativa"}
            </Badge>
            {stageName && (
              <Badge variant="outline">Auto-gera em: {stageName}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-1" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="outline" className="gap-1" onClick={toggleActive}>
            <Power className="h-4 w-4" />
            {campaign.is_active ? "Desativar" : "Ativar"}
          </Button>
          <Button variant="outline" className="gap-1 text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Remover
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mensagens geradas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats?.total ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mensagens enviadas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats?.sent ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Top leads</CardTitle></CardHeader>
          <CardContent>
            {stats && stats.topLeads.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {stats.topLeads.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <Link to={`/leads/${l.id}`} className="truncate hover:underline">
                      {l.name || "(sem nome)"}{l.company ? ` · ${l.company}` : ""}
                    </Link>
                    <span className="text-muted-foreground">{l.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Contexto</CardTitle></CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{campaign.context || "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prompt</CardTitle></CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{campaign.prompt || "—"}</p>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar campanha</DialogTitle></DialogHeader>
          <CampaignForm
            mode="edit"
            campaign={campaign}
            onSaved={() => setEditOpen(false)}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a campanha "{campaign.name}" e todas as mensagens geradas
              associadas. Não pode ser desfeita.
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
