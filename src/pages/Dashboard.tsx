import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStages } from "@/hooks/useStages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Users, Megaphone, Sparkles, Send } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
} from "recharts";

type Stat = { label: string; value: number | string; icon: React.ReactNode };

function StatCard({ label, value, icon }: Stat) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { workspace, loading: wsLoading } = useWorkspace();
  const workspaceId = workspace?.id;
  const { data: stages } = useStages(workspaceId);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard-metrics", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const [leadsRes, campaignsRes, msgsRes, sentRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, stage_id")
          .eq("workspace_id", workspaceId!),
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId!)
          .eq("is_active", true),
        supabase
          .from("lead_messages")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId!),
        supabase
          .from("lead_messages")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId!)
          .not("sent_at", "is", null),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      const counts = new Map<string, number>();
      for (const l of leadsRes.data ?? []) {
        if (!l.stage_id) continue;
        counts.set(l.stage_id, (counts.get(l.stage_id) ?? 0) + 1);
      }
      return {
        totalLeads: leadsRes.data?.length ?? 0,
        activeCampaigns: campaignsRes.count ?? 0,
        messagesGenerated: msgsRes.count ?? 0,
        messagesSent: sentRes.count ?? 0,
        countsByStage: counts,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["dashboard-activity", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, created_at, payload, lead_id")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const chartData =
    stages?.map((s) => ({
      stage_name: s.name,
      lead_count: metrics?.countsByStage.get(s.id) ?? 0,
    })) ?? [];

  const loading = wsLoading || isLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (metrics && metrics.totalLeads === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-muted-foreground">
              Nenhum lead ainda. Comece adicionando o primeiro.
            </p>
            <Button asChild>
              <Link to="/leads/new">
                <Plus className="mr-2 h-4 w-4" />
                Novo lead
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de leads"
          value={metrics?.totalLeads ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Campanhas ativas"
          value={metrics?.activeCampaigns ?? 0}
          icon={<Megaphone className="h-4 w-4" />}
        />
        <StatCard
          label="Mensagens geradas"
          value={metrics?.messagesGenerated ?? 0}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Mensagens enviadas"
          value={metrics?.messagesSent ?? 0}
          icon={<Send className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads por estágio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="stage_name"
                  width={140}
                  stroke="hsl(var(--muted-foreground))"
                />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Bar dataKey="lead_count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {recent && recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">
                    <span className="font-medium">{a.action}</span>
                    {a.lead_id && (
                      <Link
                        to={`/leads/${a.lead_id}`}
                        className="ml-2 text-primary hover:underline"
                      >
                        ver lead
                      </Link>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
