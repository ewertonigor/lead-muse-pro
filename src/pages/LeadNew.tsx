import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LeadForm } from "@/components/leads/LeadForm";

export default function LeadNew() {
  const [params] = useSearchParams();
  const stageId = params.get("stage") ?? undefined;
  useEffect(() => {
    document.title = "Novo lead · Mini CRM SDR";
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Novo lead</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados do lead. Os campos obrigatórios dependem da etapa selecionada.
        </p>
      </header>
      <LeadForm mode="create" initialStageId={stageId} />
    </div>
  );
}