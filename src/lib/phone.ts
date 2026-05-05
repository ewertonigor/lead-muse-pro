// Brazilian phone number helpers. Storage format: "+55XXXXXXXXXXX" (digits only with country code).
// Display format: "(11) 9876-5432" (10 digits) or "(11) 98765-4321" (11 digits).

export function extractDigits(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\D/g, "");
}

/** Strip a leading 55 country code (only when total length suggests it). */
function stripCountryCode(digits: string): string {
  if (digits.length > 11 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

/** Format BR phone for display while typing. Accepts any input. */
export function formatBRPhone(input: string | null | undefined): string {
  const local = stripCountryCode(extractDigits(input)).slice(0, 11);
  const len = local.length;
  if (len === 0) return "";
  if (len <= 2) return `(${local}`;
  if (len <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (len <= 10) {
    // landline: (11) 9876-5432
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  // mobile: (11) 98765-4321
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}

/** Convert a possibly-formatted phone to storage format (+55XXXXXXXXXXX) or null. */
export function toStoragePhone(input: string | null | undefined): string | null {
  const local = stripCountryCode(extractDigits(input));
  if (local.length === 0) return null;
  return `+55${local}`;
}

/** Returns the local digit count (without country code). */
export function localDigitCount(input: string | null | undefined): number {
  return stripCountryCode(extractDigits(input)).length;
}

export function isValidBRPhone(input: string | null | undefined): boolean {
  const len = localDigitCount(input);
  return len === 0 || (len >= 10 && len <= 11);
}