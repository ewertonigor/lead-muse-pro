import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads } from "@/hooks/useLeads";
import { useStages } from "@/hooks/useStages";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
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
import { Plus } from "lucide-react";

const Index = () => {
  const { workspace, loading: wsLoading } = useWorkspace();
  const { data: leads = [], isLoading } = useLeads({ workspaceId: workspace?.id });
  const { data: stages = [] } = useStages(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);

  useEffect(() => {
    document.title = "Leads · Mini CRM SDR";
  }, []);

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);
  const ownerMap = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.full_name || m.email || ""])),
    [members],
  );

  if (wsLoading || isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Lista provisória — o Kanban chega na Task 05.
          </p>
        </div>
        <Button asChild className="gap-1 shrink-0">
          <Link to="/leads/new"><Plus className="h-4 w-4" /> Novo lead</Link>
        </Button>
      </header>

      {leads.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-muted-foreground">Nenhum lead ainda.</p>
          <Button asChild className="gap-1">
            <Link to="/leads/new"><Plus className="h-4 w-4" /> Criar primeiro lead</Link>
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <Link to={`/leads/${l.id}`} className="hover:underline">
                      {l.name || "(sem nome)"}
                    </Link>
                  </TableCell>
                  <TableCell>{l.company || "—"}</TableCell>
                  <TableCell>
                    {l.stage_id && (
                      <Badge variant="secondary">{stageMap.get(l.stage_id) ?? "—"}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{l.owner_id ? ownerMap.get(l.owner_id) ?? "—" : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(l.updated_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Index;
