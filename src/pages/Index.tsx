import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

const Index = () => {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  useEffect(() => {
    document.title = "Mini CRM SDR";
  }, []);

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Bem-vindo</h1>
      <p className="text-muted-foreground">
        Autenticado como <span className="font-medium text-foreground">{user?.email}</span>
        {workspace && <> · workspace: <span className="font-medium text-foreground">{workspace.name}</span></>}
      </p>
    </div>
  );
};

export default Index;
