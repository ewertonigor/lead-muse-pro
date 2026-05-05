import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomField, KEY_REGEX, RESERVED_KEYS } from "@/hooks/useCustomFields";
import { Plus, Trash2 } from "lucide-react";

const FIELD_TYPES = ["text", "number", "date", "boolean", "select"] as const;

const FormSchema = z.object({
  label: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  key: z
    .string()
    .trim()
    .regex(KEY_REGEX, "Use snake_case minúsculo (ex: annual_revenue)")
    .refine((k) => !RESERVED_KEYS.includes(k), "Esta chave é reservada"),
  field_type: z.enum(FIELD_TYPES),
  is_required: z.boolean(),
  options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).optional(),
});
type FormValues = z.infer<typeof FormSchema>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "_$&")
    .slice(0, 41);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  field: CustomField | null;
  nextPosition: number;
  onSaved: () => void;
};

export const CustomFieldDialog = ({
  open,
  onOpenChange,
  workspaceId,
  field,
  nextPosition,
  onSaved,
}: Props) => {
  const isEdit = !!field;
  const [keyTouched, setKeyTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      label: "",
      key: "",
      field_type: "text",
      is_required: false,
      options: [],
    },
  });

  useEffect(() => {
    if (open) {
      setKeyTouched(isEdit);
      form.reset({
        label: field?.label ?? "",
        key: field?.key ?? "",
        field_type: field?.field_type ?? "text",
        is_required: field?.is_required ?? false,
        options: field?.options ?? [],
      });
    }
  }, [open, field, isEdit, form]);

  const fieldType = form.watch("field_type");
  const options = form.watch("options") ?? [];

  const handleLabelChange = (val: string) => {
    form.setValue("label", val, { shouldDirty: true });
    if (!isEdit && !keyTouched) {
      form.setValue("key", slugify(val), { shouldValidate: true });
    }
  };

  const addOption = () => {
    form.setValue("options", [...options, { value: "", label: "" }], { shouldDirty: true });
  };
  const updateOption = (i: number, patch: Partial<{ value: string; label: string }>) => {
    const next = options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    form.setValue("options", next, { shouldDirty: true });
  };
  const removeOption = (i: number) => {
    form.setValue("options", options.filter((_, idx) => idx !== i), { shouldDirty: true });
  };

  const onSubmit = async (values: FormValues) => {
    if (values.field_type === "select" && (!values.options || values.options.length === 0)) {
      toast.error("Adicione ao menos uma opção");
      return;
    }
    setSubmitting(true);
    const payload = {
      label: values.label,
      field_type: values.field_type,
      is_required: values.is_required,
      options: values.field_type === "select" ? values.options ?? [] : [],
    };
    let error;
    if (isEdit && field) {
      ({ error } = await supabase.from("custom_fields").update(payload).eq("id", field.id));
    } else {
      ({ error } = await supabase.from("custom_fields").insert({
        ...payload,
        key: values.key,
        workspace_id: workspaceId,
        position: nextPosition,
      }));
    }
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success(isEdit ? "Campo atualizado" : "Campo criado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar campo" : "Novo campo personalizado"}</DialogTitle>
          <DialogDescription>
            Campos personalizados se aplicam a todos os leads deste workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-label">Rótulo</Label>
            <Input
              id="cf-label"
              maxLength={60}
              {...form.register("label")}
              onChange={(e) => handleLabelChange(e.target.value)}
            />
            {form.formState.errors.label && (
              <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-key">Chave</Label>
            <Input
              id="cf-key"
              maxLength={41}
              disabled={isEdit}
              {...form.register("key")}
              onChange={(e) => {
                setKeyTouched(true);
                form.setValue("key", e.target.value, { shouldValidate: true, shouldDirty: true });
              }}
            />
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "A chave não pode ser alterada após a criação."
                : "Identificador interno. Use letras minúsculas, números e underscore."}
            </p>
            {form.formState.errors.key && (
              <p className="text-sm text-destructive">{form.formState.errors.key.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={fieldType}
              onValueChange={(v) => form.setValue("field_type", v as typeof FIELD_TYPES[number], { shouldDirty: true })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="date">Data</SelectItem>
                <SelectItem value="boolean">Sim/Não</SelectItem>
                <SelectItem value="select">Seleção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fieldType === "select" && (
            <div className="space-y-2">
              <Label>Opções</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="valor"
                      value={opt.value}
                      maxLength={40}
                      onChange={(e) => updateOption(i, { value: e.target.value })}
                    />
                    <Input
                      placeholder="rótulo"
                      value={opt.label}
                      maxLength={60}
                      onChange={(e) => updateOption(i, { label: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addOption} className="gap-1">
                <Plus className="h-4 w-4" /> Adicionar opção
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="cf-required" className="cursor-pointer">Obrigatório</Label>
              <p className="text-xs text-muted-foreground">
                A obrigatoriedade efetiva é definida por etapa do funil.
              </p>
            </div>
            <Switch
              id="cf-required"
              checked={form.watch("is_required")}
              onCheckedChange={(v) => form.setValue("is_required", v, { shouldDirty: true })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};