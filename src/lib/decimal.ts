/**
 * Prisma `Decimal` → plain number, at the server/client boundary (§50).
 * Decimals cannot be passed to client components, and quantities are only
 * ever converted here, explicitly.
 */
type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export function num(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function numOr(value: DecimalLike, fallback: number): number {
  return num(value) ?? fallback;
}
