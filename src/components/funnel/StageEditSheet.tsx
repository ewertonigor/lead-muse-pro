import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export type Stage = {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  required_fields: string[];
  is_default: boolean;
};

export type CustomFieldOption = { key: string; label: string };

const STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "company", label: "Empresa" },
  { key: "role", label: "Cargo" },
  { key: "source", label: "Origem" },
  { key: "notes", label: "Notas" },
];

const FormSchema = z.object({
  name: z.string().min(1, "Informe um nome").max(60),
  required_fields: z.array(z.string()),
});
type FormValues = z.infer<typeof FormSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: Stage | null;
  customFields: CustomFieldOption[];
  onSaved: () => void;
};

export const StageEditSheet = ({ open, onOpenChange, stage, customFields, onSaved }: Props) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: "", required_fields: [] },
  });

  useEffect(() => {
    if (stage) {
      form.reset({ name: stage.name, required_fields: stage.required_fields ?? [] });
    }
  }, [stage, form]);

  const toggleField = (key: string, checked: boolean) => {
    const current = form.getValues("required_fields");
    form.setValue(
      "required_fields",
      checked ? [...new Set([...current, key])] : current.filter((k) => k !== key),
      { shouldDirty: true },
    );
  };

  const onSubmit = async (values: FormValues) => {
    if (!stage) return;
    const { error } = await supabase
      .from("stages")
      .update({ name: values.name, required_fields: values.required_fields })
      .eq("id", stage.id);
    if (error) {
      toast.error("Não foi possível salvar a etapa", { description: error.message });
      return;
    }
    toast.success("Etapa atualizada");
    onSaved();
    onOpenChange(false);
  };

  const selected = form.watch("required_fields");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar etapa</SheetTitle>
          <SheetDescription>
            Defina o nome e os campos obrigatórios para mover um lead para esta etapa.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Nome</Label>
            <Input id="stage-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Campos obrigatórios</Label>
            <p className="text-xs text-muted-foreground">
              Campos padrão do lead
            </p>
            <div className="space-y-2">
              {STANDARD_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.includes(f.key)}
                    onCheckedChange={(c) => toggleField(f.key, c === true)}
                  />
                  <span>{f.label}</span>
                  <span className="text-xs text-muted-foreground">({f.key})</span>
                </label>
              ))}
            </div>

            {customFields.length > 0 && (
              <>
                <p className="pt-2 text-xs text-muted-foreground">Campos personalizados</p>
                <div className="space-y-2">
                  {customFields.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(f.key)}
                        onCheckedChange={(c) => toggleField(f.key, c === true)}
                      />
                      <span>{f.label}</span>
                      <span className="text-xs text-muted-foreground">({f.key})</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Salvar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};