export function normalizePhoneInput(value: string) {
  const rawValue = value.trim();

  if (!rawValue) {
    return null;
  }

  const digits = rawValue.replace(/\D/g, "");

  if (digits.length === 10) {
    return formatRussianPhone(`7${digits}`);
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return formatRussianPhone(`7${digits.slice(1)}`);
  }

  if (rawValue.startsWith("+") && digits.length > 0) {
    return `+${digits}`;
  }

  return rawValue.replace(/\s+/g, " ");
}

export function getPhoneHref(value: string) {
  return `tel:${value.replace(/[\s()-]/g, "")}`;
}

function formatRussianPhone(digits: string) {
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
    7,
    9,
  )}-${digits.slice(9, 11)}`;
}
