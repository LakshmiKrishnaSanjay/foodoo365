import { changePercent, moneyView, type Fils, type MoneyView } from "@/lib/money";

export interface Delta {
  text: string;
  tone: "up" | "down" | "flat";
}

export function formatBps(bps: number): string {
  const value = bps / 100;
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function deltaFor(current: Fils, previous: Fils | null, comparable: boolean): Delta | null {
  if (!comparable || previous === null) return null;
  const value = changePercent(current, previous);
  if (value === null) return null;
  const tone = value > 0.05 ? "up" : value < -0.05 ? "down" : "flat";
  return { text: `${value > 0 ? "+" : ""}${value.toFixed(1)}%`, tone };
}

export function money(amount: Fils): MoneyView {
  return moneyView(amount);
}
