/**
 * Authoritative money type for Foodoo365.
 * Amounts are integer paise (1 INR = 100 paise) so accounting never uses
 * floating-point arithmetic.
 */
export type Fils = bigint;

export const ZERO: Fils = 0n;
export const PAISE_PER_RUPEE: Fils = 100n;

const rupeeFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function inr(rupees: number, paise = 0): Fils {
  if (!Number.isInteger(rupees) || !Number.isInteger(paise)) {
    throw new Error("inr() expects integer rupees and paise");
  }
  const negative = rupees < 0 || paise < 0;
  return (negative ? -1n : 1n) * (BigInt(Math.abs(rupees)) * PAISE_PER_RUPEE + BigInt(Math.abs(paise)));
}

export function absFils(amount: Fils): Fils {
  return amount < 0n ? -amount : amount;
}

export function sumFils(values: Iterable<Fils>): Fils {
  let total: Fils = 0n;
  for (const value of values) total += value;
  return total;
}

export function minFils(a: Fils, b: Fils): Fils {
  return a < b ? a : b;
}

export function maxFils(a: Fils, b: Fils): Fils {
  return a > b ? a : b;
}

/**
 * Multiply by a rational and round half away from zero to the nearest fil.
 */
export function mulDiv(amount: Fils, numerator: bigint, denominator: bigint): Fils {
  if (denominator === 0n) throw new Error("Cannot divide money by zero");
  const negative = amount < 0n !== numerator < 0n;
  const product = absFils(amount) * absFils(numerator);
  const den = absFils(denominator);
  const rounded = (product + den / 2n) / den;
  return negative ? -rounded : rounded;
}

/** 10_000 basis points = 100%. */
export function applyBps(amount: Fils, bps: number): Fils {
  if (!Number.isInteger(bps)) throw new Error("Basis points must be an integer");
  return mulDiv(amount, BigInt(bps), 10000n);
}

export function formatInr(amount: Fils, options?: { signed?: boolean }): string {
  const negative = amount < 0n;
  const value = absFils(amount);
  const rupees = Number(value / PAISE_PER_RUPEE) + Number(value % PAISE_PER_RUPEE) / 100;
  const formatted = rupeeFormat.format(negative ? -rupees : rupees);
  if (options?.signed && amount > 0n) return `+${formatted}`;
  return formatted;
}

export function formatSignedInr(amount: Fils): string {
  return formatInr(amount, { signed: true });
}

/** Chart axes only. Never feed this back into accounting. */
export function toChartNumber(amount: Fils): number {
  const negative = amount < 0n;
  const value = absFils(amount);
  const major = Number(value / PAISE_PER_RUPEE);
  const minor = Number(value % PAISE_PER_RUPEE);
  const display = major + minor / 100;
  return negative ? -display : display;
}

export interface MoneyView {
  fils: string;
  formatted: string;
  signed: string;
  chart: number;
  negative: boolean;
  zero: boolean;
}

export function moneyView(amount: Fils): MoneyView {
  return {
    fils: amount.toString(),
    formatted: formatInr(amount),
    signed: formatSignedInr(amount),
    chart: toChartNumber(amount),
    negative: amount < 0n,
    zero: amount === 0n,
  };
}

/**
 * Display-only percentage. Returns null when the prior base is zero or missing,
 * so the UI does not invent a change.
 */
export function changePercent(current: Fils, previous: Fils | null): number | null {
  if (previous === null || previous === 0n) return null;
  const bps = mulDiv(current - previous, 10000n, previous);
  return Number(bps) / 100;
}
