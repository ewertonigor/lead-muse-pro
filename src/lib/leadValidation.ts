import type { CustomField } from "@/hooks/useCustomFields";

export type StageLite = { id: string; name: string; required_fields: string[] };

export const STANDARD_FIELD_KEYS = [
  "name", "email", "phone", "company", "role", "source", "notes",
] as const;

export type LeadValues = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
  source?: string | null;
  notes?: string | null;
  custom_data?: Record<string, unknown> | null;
};

const isEmpty = (v: unknown) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim().length === 0);

/**
 * Returns the list of required field keys that are missing for a given stage.
 * Includes:
 *  - stage.required_fields (standard or custom keys)
 *  - any workspace custom_fields with is_required = true
 */
export function validateRequiredFields(
  stage: StageLite | null | undefined,
  values: LeadValues,
  customFields: CustomField[] = [],
): string[] {
  if (!stage) return [];
  const required = new Set<string>(stage.required_fields ?? []);
  for (const cf of customFields) {
    if (cf.is_required) required.add(cf.key);
  }
  const missing: string[] = [];
  for (const key of required) {
    const val = (STANDARD_FIELD_KEYS as readonly string[]).includes(key)
      ? (values as Record<string, unknown>)[key]
      : values.custom_data?.[key];
    if (isEmpty(val)) missing.push(key);
  }
  return missing;
}