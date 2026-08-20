/** Normalize Bangladesh mobile numbers to BulkSMSBD format: 8801XXXXXXXXX */
export function normalizeBdPhone(input: string): string {
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("880") && digits.length >= 13) return digits.slice(0, 13);
  if (digits.startsWith("0") && digits.length >= 11) return `880${digits.slice(1)}`;
  if (digits.startsWith("1") && digits.length === 10) return `880${digits}`;
  return digits;
}
