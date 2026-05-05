import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, signOut } = useAuth();
  const [workspaceName, setWorkspaceName] = useState<string>("");

  useEffect(() => {
    document.title = "Mini CRM SDR";
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) setWorkspaceName(data.name);
    })();
  }, [user]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <h1 className="text-2xl font-semibold">Mini CRM SDR</h1>
      <p className="text-muted-foreground">
        Autenticado como <span className="font-medium text-foreground">{user?.email}</span>
        {workspaceName && <> · workspace: <span className="font-medium text-foreground">{workspaceName}</span></>}
      </p>
      <Button variant="outline" onClick={signOut}>Sair</Button>
    </main>
  );
};

export default Index;
