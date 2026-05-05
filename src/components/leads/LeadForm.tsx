import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStages } from "@/hooks/useStages";
import { useCustomFields, CustomField } from "@/hooks/useCustomFields";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useCreateLead, useUpdateLead, Lead, LeadInput } from "@/hooks/useLeads";
import { validateRequiredFields } from "@/lib/leadValidation";
import { isValidBRPhone, toStoragePhone, formatBRPhone, localDigitCount } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PhoneInput } from "@/components/PhoneInput";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STANDARD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  company: "Empresa",
  role: "Cargo",
  source: "Origem",
  notes: "Observações",
};

const FormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "E-mail inválido",
    }),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  stage_id: z.string().uuid("Selecione uma etapa"),
  owner_id: z.string().uuid().nullable().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

const UNASSIGNED = "__unassigned__";

const emptyToNull = (v: string | undefined | null) => {
  const s = (v ?? "").toString().trim();
  return s.length === 0 ? null : s;
};

type Props = {
  mode: "create" | "edit";
  lead?: Lead | null;
  initialStageId?: string;
};

export const LeadForm = ({ mode, lead, initialStageId }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { data: stages = [] } = useStages(workspace?.id);
  const { data: customFields = [] } = useCustomFields(workspace?.id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const createMut = useCreateLead();
  const updateMut = useUpdateLead();

  const defaultStageId = useMemo(() => {
    if (lead?.stage_id) return lead.stage_id;
    if (initialStageId) return initialStageId;
    return stages[0]?.id ?? "";
  }, [lead, stages, initialStageId]);

  const [values, setValues] = useState<FormValues>({
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    company: lead?.company ?? "",
    role: lead?.role ?? "",
    source: lead?.source ?? "",
    notes: lead?.notes ?? "",
    stage_id: defaultStageId,
    owner_id: lead?.owner_id ?? user?.id ?? null,
  });
  const [customData, setCustomData] = useState<Record<string, unknown>>(
    (lead?.custom_data as Record<string, unknown>) ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // when stages load (create mode), set default stage
  useEffect(() => {
    if (mode === "create" && !values.stage_id && stages[0]?.id) {
      setValues((v) => ({ ...v, stage_id: stages[0].id }));
    }
  }, [stages, mode, values.stage_id]);

  const setField = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => {
      const { [k as string]: _, ...rest } = prev;
      return rest;
    });
  };

  const setCustom = (key: string, v: unknown) => {
    setCustomData((prev) => {
      const next = { ...prev };
      if (v === "" || v === null || v === undefined) delete next[key];
      else next[key] = v;
      return next;
    });
    setErrors((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    const parsed = FormSchema.safeParse(values);
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]?.toString();
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
    }

    // Phone format validation (BR)
    if (values.phone && !isValidBRPhone(values.phone)) {
      fieldErrors.phone = "Telefone inválido. Use formato com DDD (ex: 11 98765-4321).";
    }

    const stage = stages.find((s) => s.id === values.stage_id);
    const phoneStorage = toStoragePhone(values.phone);
    const leadValuesForValidation = {
      name: emptyToNull(values.name),
      email: emptyToNull(values.email),
      phone: phoneStorage,
      company: emptyToNull(values.company),
      role: emptyToNull(values.role),
      source: emptyToNull(values.source),
      notes: emptyToNull(values.notes),
      custom_data: customData,
    };
    const missing = validateRequiredFields(stage, leadValuesForValidation, customFields);
    for (const m of missing) {
      if (!fieldErrors[m]) {
        const cf = customFields.find((c) => c.key === m);
        const label = cf?.label ?? STANDARD_LABELS[m] ?? m;
        fieldErrors[m] = `${label} é obrigatório nesta etapa`;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("Verifique os campos destacados");
      return;
    }

    setSubmitting(true);
    const payload: LeadInput = {
      workspace_id: workspace.id,
      name: emptyToNull(values.name),
      email: emptyToNull(values.email),
      phone: phoneStorage,
      company: emptyToNull(values.company),
      role: emptyToNull(values.role),
      source: emptyToNull(values.source),
      notes: emptyToNull(values.notes),
      stage_id: values.stage_id,
      owner_id: values.owner_id ?? null,
      custom_data: customData,
    };

    try {
      if (mode === "create") {
        const created = await createMut.mutateAsync(payload);
        toast.success("Lead criado");
        navigate(`/leads/${created.id}`);
      } else if (lead) {
        // Pre-validate on server too
        const { data: vres } = await supabase.rpc("validate_lead_for_stage", {
          p_lead_id: lead.id,
          p_target_stage_id: values.stage_id,
        });
        const row = Array.isArray(vres) ? vres[0] : vres;
        if (row && row.is_valid === false) {
          const serverMissing: string[] = row.missing_fields ?? [];
          const merged: Record<string, string> = {};
          for (const m of serverMissing) {
            const cf = customFields.find((c) => c.key === m);
            merged[m] = `${cf?.label ?? STANDARD_LABELS[m] ?? m} é obrigatório nesta etapa`;
          }
          if (Object.keys(merged).length > 0) {
            setErrors(merged);
            setSubmitting(false);
            toast.error("Campos obrigatórios faltando para a etapa selecionada");
            return;
          }
        }
        await updateMut.mutateAsync({ id: lead.id, patch: payload });
        toast.success("Lead atualizado");
        navigate(`/leads/${lead.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error("Não foi possível salvar", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const renderCustomField = (cf: CustomField) => {
    const id = `cf-${cf.key}`;
    const value = customData[cf.key];
    const error = errors[cf.key];
    const labelEl = (
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {cf.label}
        {cf.is_required && <span className="text-destructive text-xs"> *</span>}
      </Label>
    );

    let control: React.ReactNode;
    switch (cf.field_type) {
      case "number":
        control = (
          <Input
            id={id}
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => setCustom(cf.key, e.target.value === "" ? "" : Number(e.target.value))}
          />
        );
        break;
      case "date":
        control = (
          <Input
            id={id}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => setCustom(cf.key, e.target.value)}
          />
        );
        break;
      case "boolean":
        control = (
          <div className="flex h-10 items-center">
            <Switch
              id={id}
              checked={!!value}
              onCheckedChange={(v) => setCustom(cf.key, v)}
            />
          </div>
        );
        break;
      case "select":
        control = (
          <Select
            value={(value as string) ?? ""}
            onValueChange={(v) => setCustom(cf.key, v)}
          >
            <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {cf.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        break;
      default:
        control = (
          <Input
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => setCustom(cf.key, e.target.value)}
          />
        );
    }

    return (
      <div key={cf.id} className="space-y-1.5">
        {labelEl}
        {control}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="name" className="text-sm font-medium text-foreground">
            Nome <span className="text-destructive text-xs">*</span>
          </Label>
          <Input id="name" value={values.name} onChange={(e) => setField("name", e.target.value)} maxLength={120} />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</Label>
          <Input id="email" type="email" value={values.email ?? ""} onChange={(e) => setField("email", e.target.value)} maxLength={255} />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-foreground">Telefone</Label>
          <PhoneInput
            id="phone"
            value={values.phone ?? ""}
            onDigitsChange={(d) => setField("phone", d)}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company" className="text-sm font-medium text-foreground">Empresa</Label>
          <Input id="company" value={values.company ?? ""} onChange={(e) => setField("company", e.target.value)} maxLength={120} />
          {errors.company && <p className="text-sm text-destructive">{errors.company}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role" className="text-sm font-medium text-foreground">Cargo</Label>
          <Input id="role" value={values.role ?? ""} onChange={(e) => setField("role", e.target.value)} maxLength={120} />
          {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source" className="text-sm font-medium text-foreground">Origem</Label>
          <Input id="source" value={values.source ?? ""} onChange={(e) => setField("source", e.target.value)} maxLength={120} />
          {errors.source && <p className="text-sm text-destructive">{errors.source}</p>}
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="notes" className="text-sm font-medium text-foreground">Observações</Label>
          <Textarea id="notes" value={values.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} rows={4} maxLength={2000} />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
        </div>
      </section>

      <Separator />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Etapa <span className="text-destructive text-xs">*</span>
          </Label>
          <Select value={values.stage_id} onValueChange={(v) => setField("stage_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.stage_id && <p className="text-sm text-destructive">{errors.stage_id}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Responsável</Label>
          <Select
            value={values.owner_id ?? UNASSIGNED}
            onValueChange={(v) => setField("owner_id", v === UNASSIGNED ? null : v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Sem responsável</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  <span className="inline-flex items-center gap-2">
                    <UserAvatar email={m.email} name={m.full_name} size={20} />
                    {m.full_name || m.email || m.user_id.slice(0, 8)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {customFields.length > 0 && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">Campos personalizados</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {customFields.map(renderCustomField)}
            </div>
          </section>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : mode === "create" ? "Criar lead" : "Salvar"}
        </Button>
      </div>
    </form>
  );
};