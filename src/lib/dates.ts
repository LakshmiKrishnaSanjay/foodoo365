/** Inclusive ISO date, YYYY-MM-DD, interpreted as a calendar date in UTC. */
export type IsoDate = string;

export const DEMO_START: IsoDate = "2026-05-01";
export const DEMO_END: IsoDate = "2026-10-25";
export const AS_OF: IsoDate = "2026-10-26";
export const CHARITY_BPS = 2000;
/** 5% GST on restaurant and food-truck meals, stored as basis points. Input tax credit is not available. */
export const GST_BPS = 500;
/** Share of eligible sales collected on UPI. UPI merchant charges are 0%. */
export const UPI_SHARE_BPS = 7000;
/** Share of eligible sales collected on cards. */
export const CARD_SHARE_BPS = 3000;
/** Card merchant fee, applied only to the card share. */
export const CARD_FEE_BPS = 180;

export function parseIso(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function inRange(iso: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return iso >= from && iso <= to;
}

export function eachDate(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function weekday(iso: IsoDate): number {
  return parseIso(iso).getUTCDay();
}

export function isWeekend(iso: IsoDate): boolean {
  const day = weekday(iso);
  return day === 0 || day === 5 || day === 6;
}

export function monthKey(iso: IsoDate): string {
  return iso.slice(0, 7);
}

export function monthStart(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: IsoDate): IsoDate {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  next.setUTCDate(0);
  return toIso(next);
}

export function shiftRange(from: IsoDate, to: IsoDate): { from: IsoDate; to: IsoDate } | null {
  const start = parseIso(from).getTime();
  const end = parseIso(to).getTime();
  const length = Math.round((end - start) / 86_400_000) + 1;
  if (length <= 0) return null;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

export function rangeCovered(from: IsoDate, to: IsoDate, dataStart: IsoDate, dataEnd: IsoDate): boolean {
  return from >= dataStart && to <= dataEnd && from <= to;
}

const longDate = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function formatLongDate(iso: IsoDate): string {
  return longDate.format(parseIso(iso));
}

export function formatMonth(key: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIso(`${key}-01`));
}

/** Axis label for a chart bucket. A single day is DD MMM. A longer bucket shows both ends. */
export function formatChartLabel(start: IsoDate, end: IsoDate): string {
  if (start === end) return shortDate.format(parseIso(start));
  if (start.endsWith("-01") && end === monthEnd(start) && start.slice(0, 7) === end.slice(0, 7)) return formatMonth(start.slice(0, 7));
  return `${shortDate.format(parseIso(start))} – ${shortDate.format(parseIso(end))}`;
}

export function clampRange(from: IsoDate | undefined, to: IsoDate | undefined): { from: IsoDate; to: IsoDate } {
  let start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : addDays(DEMO_END, -29);
  let end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : DEMO_END;
  if (start < DEMO_START) start = DEMO_START;
  if (end > DEMO_END) end = DEMO_END;
  if (start > end) return { from: end, to: end };
  return { from: start, to: end };
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
