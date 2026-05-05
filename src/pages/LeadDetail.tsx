import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLead, useDeleteLead } from "@/hooks/useLeads";
import { useStages } from "@/hooks/useStages";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { LeadForm } from "@/components/leads/LeadForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LeadMessagesTab } from "@/components/leads/LeadMessagesTab";
import { LeadActivityTab } from "@/components/leads/LeadActivityTab";

const STANDARD: { key: "name" | "email" | "phone" | "company" | "role" | "source" | "notes"; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "company", label: "Empresa" },
  { key: "role", label: "Cargo" },
  { key: "source", label: "Origem" },
  { key: "notes", label: "Observações" },
];

export default function LeadDetail() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { data: lead, isLoading } = useLead(leadId);
  const { data: stages = [] } = useStages(workspace?.id);
  const { data: customFields = [] } = useCustomFields(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const deleteMut = useDeleteLead();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    document.title = lead?.name ? `${lead.name} · SDR.ai` : "Lead · SDR.ai";
  }, [lead?.name]);

  const stage = useMemo(
    () => stages.find((s) => s.id === lead?.stage_id) ?? null,
    [stages, lead?.stage_id],
  );
  const owner = useMemo(
    () => members.find((m) => m.user_id === lead?.owner_id) ?? null,
    [members, lead?.owner_id],
  );

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!lead) return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Lead não encontrado.</p>
      <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
    </div>
  );

  const handleDelete = async () => {
    if (!workspace) return;
    try {
      await deleteMut.mutateAsync({ id: lead.id, workspaceId: workspace.id });
      toast.success("Lead excluído");
      navigate("/");
    } catch (err) {
      toast.error("Erro ao excluir", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const cd = (lead.custom_data ?? {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-semibold truncate">{lead.name || "(sem nome)"}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {stage && <Badge variant="secondary">{stage.name}</Badge>}
            {owner ? (
              <span>Responsável: {owner.full_name || owner.email}</span>
            ) : (
              <span>Sem responsável</span>
            )}
          </div>
        </div>
        {!editing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="gap-1 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        )}
      </header>

      {editing ? (
        <Card className="p-6">
          <LeadForm mode="edit" lead={lead} />
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar edição
            </Button>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="messages">Mensagens IA</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="p-6">
              <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                {STANDARD.map(({ key, label }) => {
                  const v = lead[key];
                  if (!v) return null;
                  return (
                    <div key={key} className={key === "notes" ? "md:col-span-2" : ""}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className={`mt-1 ${key === "notes" ? "whitespace-pre-wrap" : ""}`}>{v}</dd>
                    </div>
                  );
                })}
                {customFields.map((cf) => {
                  const raw = cd[cf.key];
                  if (raw === undefined || raw === null || raw === "") return null;
                  let display: string;
                  if (cf.field_type === "boolean") display = raw ? "Sim" : "Não";
                  else if (cf.field_type === "select")
                    display = cf.options.find((o) => o.value === raw)?.label ?? String(raw);
                  else display = String(raw);
                  return (
                    <div key={cf.id}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{cf.label}</dt>
                      <dd className="mt-1">{display}</dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <LeadMessagesTab leadId={lead.id} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <LeadActivityTab leadId={lead.id} />
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados deste lead serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}