import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStages } from "@/hooks/useStages";
import {
  Campaign,
  CampaignInput,
  useCreateCampaign,
  useUpdateCampaign,
} from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

const Schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(80),
  is_active: z.boolean(),
  context: z.string().trim().min(50, "Adicione mais contexto — ao menos 50 caracteres"),
  prompt: z.string().trim().min(50, "Adicione mais instruções — ao menos 50 caracteres"),
  trigger_stage_id: z.string().uuid().nullable(),
});
type FormValues = z.infer<typeof Schema>;

const CONTEXT_PLACEHOLDER = `Descreva a oferta, produto/serviço, empresa, período e contexto que a IA precisa.
Ex.: "Estamos rodando uma promo de Black Friday de 25/11 a 01/12 com 40% de desconto no plano 'Pro', nosso SaaS para e-commerce mid-market. O desconto vale para planos anuais. Nossa empresa ajuda lojas online a reduzir abandono de carrinho."`;

const PROMPT_PLACEHOLDER = `Defina persona, tom, tamanho e formato das mensagens.
Ex.: "Você é um SDR consultivo sênior. Tom: caloroso, direto, nunca apelativo. Formato: e-mail curto (≤120 palavras) com assunto. Cite a empresa e o segmento do lead quando relevante. Inclua um único CTA suave: uma call de 15 minutos. Assine 'Abraço, Carol'."`;

type Props = {
  mode: "create" | "edit";
  campaign?: Campaign | null;
  onSaved?: (c: Campaign) => void;
  onCancel?: () => void;
};

export const CampaignForm = ({ mode, campaign, onSaved, onCancel }: Props) => {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { data: stages = [] } = useStages(workspace?.id);
  const createMut = useCreateCampaign();
  const updateMut = useUpdateCampaign();

  const [values, setValues] = useState<FormValues>({
    name: campaign?.name ?? "",
    is_active: campaign?.is_active ?? true,
    context: campaign?.context ?? "",
    prompt: campaign?.prompt ?? "",
    trigger_stage_id: campaign?.trigger_stage_id ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (campaign) {
      setValues({
        name: campaign.name,
        is_active: campaign.is_active,
        context: campaign.context ?? "",
        prompt: campaign.prompt ?? "",
        trigger_stage_id: campaign.trigger_stage_id,
      });
    }
  }, [campaign]);

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => {
      const { [k as string]: _, ...rest } = p;
      return rest;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    const parsed = Schema.safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0]?.toString();
        if (k && !fe[k]) fe[k] = i.message;
      }
      setErrors(fe);
      toast.error("Verifique os campos destacados");
      return;
    }
    setSubmitting(true);
    const payload: CampaignInput = {
      workspace_id: workspace.id,
      name: parsed.data.name,
      context: parsed.data.context,
      prompt: parsed.data.prompt,
      trigger_stage_id: parsed.data.trigger_stage_id,
      is_active: parsed.data.is_active,
    };
    try {
      const saved =
        mode === "create"
          ? await createMut.mutateAsync(payload)
          : await updateMut.mutateAsync({ id: campaign!.id, patch: payload });
      toast.success(mode === "create" ? "Campanha criada" : "Campanha atualizada");
      if (onSaved) onSaved(saved);
      else navigate(`/campaigns/${saved.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error("Não foi possível salvar", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-foreground">
            Nome <span className="text-destructive text-xs">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            maxLength={80}
            placeholder="Ex.: Black Friday 2024"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="flex h-10 items-center gap-2">
          <Switch
            id="is_active"
            checked={values.is_active}
            onCheckedChange={(v) => setField("is_active", v)}
          />
          <Label htmlFor="is_active" className="text-sm font-medium text-foreground">Ativa</Label>
        </div>
      </section>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="context" className="text-sm font-medium text-foreground">
          Contexto <span className="text-destructive text-xs">*</span>
        </Label>
        <Textarea
          id="context"
          rows={6}
          value={values.context}
          onChange={(e) => setField("context", e.target.value)}
          placeholder={CONTEXT_PLACEHOLDER}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{errors.context && <span className="text-destructive">{errors.context}</span>}</span>
          <span>{values.context.length} caracteres</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prompt" className="text-sm font-medium text-foreground">
          Prompt <span className="text-destructive text-xs">*</span>
        </Label>
        <Textarea
          id="prompt"
          rows={6}
          value={values.prompt}
          onChange={(e) => setField("prompt", e.target.value)}
          placeholder={PROMPT_PLACEHOLDER}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{errors.prompt && <span className="text-destructive">{errors.prompt}</span>}</span>
          <span>{values.prompt.length} caracteres</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">Etapa gatilho</Label>
        <Select
          value={values.trigger_stage_id ?? NONE}
          onValueChange={(v) => setField("trigger_stage_id", v === NONE ? null : v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhuma — geração manual</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Se definida, quando um lead entrar nesta etapa as mensagens serão geradas automaticamente em background.
          Várias campanhas podem compartilhar o mesmo gatilho.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => (onCancel ? onCancel() : navigate(-1))}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : mode === "create" ? "Criar campanha" : "Salvar"}
        </Button>
      </div>
    </form>
  );
};
