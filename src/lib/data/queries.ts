import { applyBps, mulDiv, sumFils, ZERO, type Fils } from "@/lib/money";
import {
  addDays,
  clampRange,
  DEMO_END,
  DEMO_START,
  eachDate,
  firstParam,
  formatChartLabel,
  formatLongDate,
  formatMonth,
  monthEnd,
  monthKey,
  parseIso,
  rangeCovered,
  shiftRange,
} from "@/lib/dates";
import type { Investment, Truck, World } from "@/lib/domain";
import { reconcileInventory, type InventoryMovement } from "@/lib/finance/inventory";
import { calculateTruckProfit, partitionExpenses, shareOfProfit, type TruckProfitResult } from "@/lib/finance/profit-engine";
import { getWorld } from "@/lib/demo/world";
import { isSupabaseMode } from "@/lib/supabase/mode";
import { loadSupabaseWorld } from "@/lib/supabase/load";
import { deltaFor, formatBps, money, type Delta } from "@/lib/data/present";
import type { MoneyView } from "@/lib/money";

export interface Filters {
  from: string;
  to: string;
  previous: { from: string; to: string } | null;
  comparable: boolean;
  truck: string;
  category: string;
  q: string;
  page: number;
  type: string;
  status: string;
  view: "grid" | "table";
  report: string;
  notice: "all" | "unread";
  pageSize: number;
}

export interface Scope {
  world: World;
  investorId: string;
  investments: Investment[];
  trucks: Truck[];
  truckIds: Set<string>;
}

const PAGE_SIZE = 12;

export function parseFilters(input: Record<string, string | string[] | undefined>): Filters {
  const range = clampRange(firstParam(input.from), firstParam(input.to));
  const shifted = shiftRange(range.from, range.to);
  const comparable = shifted ? rangeCovered(shifted.from, shifted.to, DEMO_START, DEMO_END) : false;
  const page = Number(firstParam(input.page) ?? "1");
  return {
    from: range.from,
    to: range.to,
    previous: comparable && shifted ? shifted : null,
    comparable,
    truck: firstParam(input.truck) || "all",
    category: firstParam(input.category) || "all",
    q: (firstParam(input.q) || "").trim(),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    type: firstParam(input.type) || "all",
    status: firstParam(input.status) || "all",
    view: firstParam(input.view) === "table" ? "table" : "grid",
    report: firstParam(input.report) || "position",
    notice: firstParam(input.notice) === "unread" ? "unread" : "all",
    pageSize: PAGE_SIZE,
  };
}

export function preservedQuery(filters: Filters, patch: Record<string, string | null> = {}): string {
  const params = new URLSearchParams();
  const values: Record<string, string> = {
    from: filters.from,
    to: filters.to,
    truck: filters.truck,
    category: filters.category,
    q: filters.q,
    type: filters.type,
    status: filters.status,
    view: filters.view,
    report: filters.report,
    notice: filters.notice,
  };
  for (const [key, value] of Object.entries({ ...values, ...patch })) {
    if (!value || value === "all" || (key === "view" && value === "grid") || (key === "report" && value === "position") || (key === "notice" && value === "all")) {
      continue;
    }
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function worldFor(): Promise<World> {
  return isSupabaseMode() ? loadSupabaseWorld() : getWorld();
}

export async function getScope(investorId: string): Promise<Scope | null> {
  const world = await worldFor();
  const investments = world.investments.filter((investment) => investment.investorId === investorId);
  if (!world.investors.some((investor) => investor.id === investorId) && investments.length === 0) return null;
  const truckIds = new Set(investments.map((investment) => investment.truckId));
  return {
    world,
    investorId,
    investments,
    truckIds,
    trucks: world.trucks.filter((truck) => truckIds.has(truck.id)),
  };
}

function selectedTrucks(scope: Scope, truck: string): Truck[] {
  if (truck === "all") return scope.trucks;
  return scope.trucks.filter((item) => item.id === truck);
}

function productName(world: World, id: string): string {
  return world.products.find((product) => product.id === id)?.name ?? "Meal";
}

function productCategory(world: World, id: string): string {
  return world.products.find((product) => product.id === id)?.category ?? "Other";
}

function truckName(scope: Scope, id: string): string {
  const truck = scope.trucks.find((item) => item.id === id);
  return truck ? `Truck ${truck.code} · ${truck.name}` : "Truck";
}

interface Portfolio {
  parts: TruckProfitResult[];
  eligible: Fils;
  gross: Fils;
  discounts: Fils;
  refunds: Fils;
  tax: Fils;
  charity: Fils;
  cogs: Fils;
  operating: Fils;
  other: Fils;
  operatingProfit: Fils;
  reserves: Fils;
  adjustments: Fils;
  distributable: Fils;
  investorShare: Fils;
  attributedCharity: Fils;
  meals: number;
}

function rangePortfolio(scope: Scope, trucks: Truck[], from: string, to: string): Portfolio {
  const parts = trucks.map((truck) => {
    const adjustments = scope.world.adjustments.filter((adjustment) => {
      if (adjustment.truckId !== truck.id) return false;
      const period = scope.world.periods.find((item) => item.id === adjustment.periodId);
      return Boolean(period && period.start >= from && period.end <= to);
    });
    return calculateTruckProfit({
      truckId: truck.id,
      periodId: `${truck.id}:${from}:${to}`,
      periodStart: from,
      periodEnd: to,
      status: "open",
      reserveBps: truck.reserveBps,
      entitlementBpsTotal: scope.world.entitlementTotals[truck.id] ?? 0,
      sales: scope.world.sales,
      expenses: scope.world.expenses,
      cogs: scope.world.cogs,
      adjustments,
    });
  });
  const pick = (read: (part: TruckProfitResult) => Fils) => sumFils(parts.map(read));
  let investorShare = ZERO;
  let attributedCharity = ZERO;
  for (const part of parts) {
    const agreements = scope.investments.filter((investment) => investment.truckId === part.truckId && investment.status === "active");
    for (const agreement of agreements) {
      investorShare += shareOfProfit(part.distributableProfit, agreement.entitlementBps);
      attributedCharity += applyBps(part.charityAllocation, agreement.entitlementBps);
    }
  }
  return {
    parts,
    eligible: pick((part) => part.eligibleSales),
    gross: pick((part) => part.grossSales),
    discounts: pick((part) => part.discounts),
    refunds: pick((part) => part.refunds),
    tax: pick((part) => part.taxCollected),
    charity: pick((part) => part.charityAllocation),
    cogs: pick((part) => part.cogs),
    operating: pick((part) => part.operatingExpenses),
    other: pick((part) => part.otherCosts),
    operatingProfit: pick((part) => part.operatingProfit),
    reserves: pick((part) => part.reserves),
    adjustments: pick((part) => part.adjustments),
    distributable: pick((part) => part.distributableProfit),
    investorShare,
    attributedCharity,
    meals: parts.reduce((total, part) => total + part.mealsSold, 0),
  };
}

function chartSlices(from: string, to: string): Array<{ key: string; start: string; end: string }> {
  const days = Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000) + 1;
  const slices: Array<{ key: string; start: string; end: string }> = [];
  if (days > 90) {
    let cursor = from;
    while (cursor <= to) {
      const end = monthEnd(cursor) < to ? monthEnd(cursor) : to;
      slices.push({ key: monthKey(cursor), start: cursor, end });
      cursor = addDays(end, 1);
    }
    return slices;
  }
  if (days <= 31) {
    for (const date of eachDate(from, to)) slices.push({ key: date, start: date, end: date });
    return slices;
  }
  let cursor = from;
  while (cursor <= to) {
    const end = addDays(cursor, 6) < to ? addDays(cursor, 6) : to;
    slices.push({ key: cursor, start: cursor, end });
    cursor = addDays(end, 1);
  }
  return slices;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * pageSize;
  return { rows: items.slice(start, start + pageSize), page: current, pages, total: items.length };
}

export interface TxRow {
  id: string;
  date: string;
  dateLabel: string;
  type: string;
  truck: string;
  description: string;
  reference: string;
  amount: MoneyView;
  direction: string;
  status: string;
}

function transactionsFor(scope: Scope, trucks: Truck[], from: string, to: string): TxRow[] {
  const ids = new Set(trucks.map((truck) => truck.id));
  const rows: TxRow[] = [];
  const sales = new Map<string, { eligible: Fils; truckId: string; date: string }>();
  const charity = new Map<string, { amount: Fils; truckId: string; date: string }>();
  for (const sale of scope.world.sales) {
    if (!ids.has(sale.truckId) || sale.date < from || sale.date > to) continue;
    const key = `${sale.truckId}|${sale.date}`;
    const current = sales.get(key) ?? { eligible: ZERO, truckId: sale.truckId, date: sale.date };
    current.eligible += sale.eligible;
    sales.set(key, current);
    const charityRow = charity.get(key) ?? { amount: ZERO, truckId: sale.truckId, date: sale.date };
    charityRow.amount += sale.charity;
    charity.set(key, charityRow);
  }
  for (const [key, sale] of sales) {
    rows.push({
      id: `TX-SAL-${key}`,
      date: sale.date,
      dateLabel: formatLongDate(sale.date),
      type: "Sale",
      truck: truckName(scope, sale.truckId),
      description: "Daily eligible sales settlement",
      reference: `DAY-${sale.date.replaceAll("-", "")}`,
      amount: money(sale.eligible),
      direction: "Truck inflow",
      status: "Recorded",
    });
  }
  for (const [key, row] of charity) {
    if (row.amount === ZERO) continue;
    rows.push({
      id: `TX-CHR-${key}`,
      date: row.date,
      dateLabel: formatLongDate(row.date),
      type: "Charity",
      truck: truckName(scope, row.truckId),
      description: "20% charity allocation on eligible sales",
      reference: `CHR-${row.date.replaceAll("-", "")}`,
      amount: money(row.amount),
      direction: "Allocation",
      status: "Allocated",
    });
  }
  const { kept, duplicateIds, charityIds } = partitionExpenses(scope.world.expenses.filter((expense) => ids.has(expense.truckId)));
  const rejected = new Set([...duplicateIds, ...charityIds]);
  for (const expense of scope.world.expenses) {
    if (!ids.has(expense.truckId) || expense.date < from || expense.date > to) continue;
    const isRejected = rejected.has(expense.id);
    if (!isRejected && !kept.some((item) => item.id === expense.id)) continue;
    rows.push({
      id: `TX-${expense.id}`,
      date: expense.date,
      dateLabel: formatLongDate(expense.date),
      type: isRejected ? "Rejected" : "Expense",
      truck: truckName(scope, expense.truckId),
      description: expense.description,
      reference: expense.reference,
      amount: money(expense.amount),
      direction: isRejected ? "Excluded" : "Truck outflow",
      status: charityIds.includes(expense.id)
        ? "Rejected — duplicate charity deduction"
        : duplicateIds.includes(expense.id)
          ? "Rejected — duplicate expense"
          : "Approved",
    });
  }
  for (const payout of scope.world.payouts) {
    if (payout.investorId !== scope.investorId || !ids.has(payout.truckId) || payout.date < from || payout.date > to) continue;
    rows.push({
      id: `TX-${payout.id}`,
      date: payout.date,
      dateLabel: formatLongDate(payout.date),
      type: "Payout",
      truck: truckName(scope, payout.truckId),
      description: payout.note,
      reference: payout.reference,
      amount: money(payout.amount),
      direction: "Investor inflow",
      status: payout.status === "paid" ? "Paid" : "Approved",
    });
  }
  for (const investment of scope.investments) {
    if (!ids.has(investment.truckId) || investment.investedOn < from || investment.investedOn > to) continue;
    rows.push({
      id: `TX-${investment.id}`,
      date: investment.investedOn,
      dateLabel: formatLongDate(investment.investedOn),
      type: "Capital",
      truck: truckName(scope, investment.truckId),
      description: "Investment capital contribution",
      reference: investment.agreementRef,
      amount: money(investment.amount),
      direction: "Investor outflow",
      status: "Funded",
    });
  }
  for (const adjustment of scope.world.adjustments) {
    if (!ids.has(adjustment.truckId) || adjustment.date < from || adjustment.date > to) continue;
    rows.push({
      id: `TX-${adjustment.id}`,
      date: adjustment.date,
      dateLabel: formatLongDate(adjustment.date),
      type: "Adjustment",
      truck: truckName(scope, adjustment.truckId),
      description: adjustment.reason,
      reference: adjustment.reference,
      amount: money(adjustment.distributableDelta < 0n ? -adjustment.distributableDelta : adjustment.distributableDelta),
      direction: adjustment.distributableDelta < 0n ? "Reduces distributable profit" : "Increases distributable profit",
      status: "Controlled adjustment",
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)));
}

function kpi(label: string, hint: string, amount: Fils, previous: Fils | null, comparable: boolean, tone: "default" | "gold" | "positive" = "default") {
  return { label, hint, amount: money(amount), delta: deltaFor(amount, previous, comparable), tone };
}

export async function getOverview(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const current = rangePortfolio(scope, trucks, filters.from, filters.to);
  const prior = filters.previous ? rangePortfolio(scope, trucks, filters.previous.from, filters.previous.to) : null;
  const capital = sumFils(scope.investments.filter((investment) => trucks.some((truck) => truck.id === investment.truckId)).map((investment) => investment.amount));
  const paid = sumFils(
    scope.world.payouts
      .filter((payout) => payout.investorId === investorId && payout.status === "paid" && payout.date >= filters.from && payout.date <= filters.to && trucks.some((truck) => truck.id === payout.truckId))
      .map((payout) => payout.amount),
  );
  const paidPrior = prior
    ? sumFils(
        scope.world.payouts
          .filter((payout) => payout.investorId === investorId && payout.status === "paid" && filters.previous && payout.date >= filters.previous.from && payout.date <= filters.previous.to && trucks.some((truck) => truck.id === payout.truckId))
          .map((payout) => payout.amount),
      )
    : null;
  const pending = sumFils(
    scope.world.payouts
      .filter((payout) => payout.investorId === investorId && payout.status === "approved" && trucks.some((truck) => truck.id === payout.truckId))
      .map((payout) => payout.amount),
  );
  const months = chartSlices(filters.from, filters.to).map((slice) => {
    const portfolio = rangePortfolio(scope, trucks, slice.start, slice.end);
    return {
      label: formatChartLabel(slice.start, slice.end),
      revenue: portfolio.eligible,
      profit: portfolio.distributable,
      earnings: portfolio.investorShare,
      expenses: portfolio.cogs + portfolio.operating + portfolio.other,
      charity: portfolio.charity,
    };
  });
  const cards = trucks.map((truck) => {
    const part = current.parts.find((item) => item.truckId === truck.id);
    const agreement = scope.investments.find((investment) => investment.truckId === truck.id);
    const share = part && agreement ? shareOfProfit(part.distributableProfit, agreement.entitlementBps) : ZERO;
    const attributed = part && agreement ? applyBps(part.charityAllocation, agreement.entitlementBps) : ZERO;
    return {
      id: truck.id,
      code: truck.code,
      name: truck.name,
      location: `${truck.location}, ${truck.district}`,
      status: truck.status,
      statusNote: truck.statusNote,
      sales: money(part?.eligibleSales ?? ZERO),
      meals: part?.mealsSold ?? 0,
      profit: money(part?.distributableProfit ?? ZERO),
      entitlement: formatBps(agreement?.entitlementBps ?? 0),
      earnings: money(share),
      charity: money(attributed),
    };
  });
  return {
    rangeLabel: `${formatLongDate(filters.from)} – ${formatLongDate(filters.to)}`,
    kpis: [
      kpi("Total invested capital", "Capital you have committed to the trucks in this view.", capital, null, false, "gold"),
      kpi("Total truck revenue", "Eligible sales of your trucks. This is not your personal earnings.", current.eligible, prior?.eligible ?? null, filters.comparable),
      kpi("Net profit of invested trucks", "Distributable profit of the trucks, before your personal share.", current.distributable, prior?.distributable ?? null, filters.comparable),
      kpi("Investor earned profit", "Your contractual share of distributable profit for these dates.", current.investorShare, prior?.investorShare ?? null, filters.comparable, "gold"),
      kpi("Total profit paid out", "Payouts marked paid during the selected dates.", paid, paidPrior, filters.comparable, "positive"),
      kpi("Pending profit payout", "Approved earnings that have not been paid yet.", pending, null, false),
      { label: "Meals sold", hint: "Meals sold by your trucks in the selected dates.", amount: null, count: current.meals.toLocaleString("en-IN"), delta: deltaFor(BigInt(current.meals), prior ? BigInt(prior.meals) : null, filters.comparable), tone: "default" as const },
      kpi("Charity contribution attributed", "Your entitlement percentage of the 20% charity allocation.", current.attributedCharity, prior?.attributedCharity ?? null, filters.comparable, "positive"),
    ],
    months: months.map((month) => ({
      label: month.label,
      revenue: money(month.revenue).chart,
      profit: money(month.profit).chart,
      earnings: money(month.earnings).chart,
      expenses: money(month.expenses).chart,
      charity: money(month.charity).chart,
    })),
    trucks: cards,
    truckComparison: cards.map((card) => ({ name: `Truck ${card.code}`, revenue: card.sales.chart, profit: card.profit.chart })),
    transactions: transactionsFor(scope, trucks, filters.from, filters.to).slice(0, 6),
    distributions: scope.world.payouts
      .filter((payout) => payout.investorId === investorId && payout.status === "paid" && payout.date >= filters.from && payout.date <= filters.to && trucks.some((truck) => truck.id === payout.truckId))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4)
      .map((payout) => ({
        id: payout.id,
        date: formatLongDate(payout.date),
        truck: truckName(scope, payout.truckId),
        amount: money(payout.amount),
        reference: payout.reference,
      })),
    charity: scope.world.charityUses
      .filter((use) => trucks.some((truck) => truck.id === use.truckId) && use.date >= filters.from && use.date <= filters.to)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4)
      .map((use) => ({
        id: use.id,
        date: formatLongDate(use.date),
        truck: truckName(scope, use.truckId),
        status: use.status,
        meals: use.meals,
        amount: money(use.amount),
      })),
    upcoming: scope.world.payouts
      .filter((payout) => payout.investorId === investorId && payout.status === "approved" && trucks.some((truck) => truck.id === payout.truckId))
      .map((payout) => ({
        id: payout.id,
        date: formatLongDate(payout.date),
        truck: truckName(scope, payout.truckId),
        amount: money(payout.amount),
        reference: payout.reference,
        note: payout.note,
      })),
  };
}

export async function getInvestments(investorId: string) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  return scope.investments.map((investment) => {
    const truck = scope.trucks.find((item) => item.id === investment.truckId);
    const earnings = scope.world.earnings.filter((earning) => earning.investmentId === investment.id);
    const payouts = scope.world.payouts.filter((payout) => payout.investmentId === investment.id && payout.investorId === investorId);
    const paid = sumFils(payouts.filter((payout) => payout.status === "paid").map((payout) => payout.amount));
    const unpaid = sumFils(payouts.filter((payout) => payout.status === "approved").map((payout) => payout.amount));
    return {
      id: investment.id,
      truckId: investment.truckId,
      truck: truck ? `Truck ${truck.code} · ${truck.name}` : "Truck",
      location: truck ? `${truck.location}, ${truck.district}` : "",
      date: formatLongDate(investment.investedOn),
      amount: money(investment.amount),
      ownership: investment.ownershipBps === null ? "Not applicable" : formatBps(investment.ownershipBps),
      entitlement: formatBps(investment.entitlementBps),
      status: investment.status,
      earnings: money(sumFils(earnings.map((earning) => earning.earnedProfit))),
      paid: money(paid),
      unpaid: money(unpaid),
      agreementRef: investment.agreementRef,
    };
  });
}

export async function getInvestmentDetail(investorId: string, id: string) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const investment = scope.investments.find((item) => item.id === id);
  if (!investment) return null;
  const truck = scope.trucks.find((item) => item.id === investment.truckId);
  if (!truck) return null;
  const earnings = scope.world.earnings.filter((earning) => earning.investmentId === investment.id);
  const payouts = scope.world.payouts.filter((payout) => payout.investmentId === investment.id && payout.investorId === investorId);
  const periods = scope.world.profits.filter((profit) => profit.truckId === truck.id);
  return {
    id: investment.id,
    truckId: truck.id,
    truck: `Truck ${truck.code} · ${truck.name}`,
    location: `${truck.location}, ${truck.district}`,
    status: investment.status,
    date: formatLongDate(investment.investedOn),
    amount: money(investment.amount),
    ownership: investment.ownershipBps === null ? "Not recorded" : formatBps(investment.ownershipBps),
    entitlement: formatBps(investment.entitlementBps),
    agreementRef: investment.agreementRef,
    lossCarryforward: investment.lossCarryforward,
    notes: investment.notes,
    earningsTotal: money(sumFils(earnings.map((earning) => earning.earnedProfit))),
    paid: money(sumFils(payouts.filter((payout) => payout.status === "paid").map((payout) => payout.amount))),
    unpaid: money(sumFils(payouts.filter((payout) => payout.status === "approved").map((payout) => payout.amount))),
    history: earnings.map((earning) => {
      const profit = periods.find((item) => item.periodId === earning.periodId);
      const snapshot = scope.world.snapshots.find((item) => item.periodId === earning.periodId);
      const paid = sumFils(payouts.filter((payout) => payout.periodId === earning.periodId && payout.status === "paid").map((payout) => payout.amount));
      const unpaid = sumFils(payouts.filter((payout) => payout.periodId === earning.periodId && payout.status === "approved").map((payout) => payout.amount));
      return {
        period: formatMonth(earning.periodStart.slice(0, 7)),
        status: earning.periodStatus,
        revenue: money(profit?.eligibleSales ?? ZERO),
        distributable: money(profit?.distributableProfit ?? ZERO),
        share: money(earning.shareBeforeCarryforward),
        carryforward: money(earning.carryforwardApplied),
        earned: money(earning.earnedProfit),
        approved: money(earning.approvedEarnings),
        paid: money(paid),
        outstanding: money(unpaid),
        snapshotMatches: snapshot ? snapshot.distributableProfit === profit?.distributableProfit : earning.periodStatus !== "finalized",
        audit: (profit?.audit ?? []).map((line) => ({ step: line.step, detail: line.detail, amount: money(line.amount) })),
      };
    }),
    payouts: payouts
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((payout) => ({
        id: payout.id,
        date: formatLongDate(payout.date),
        amount: money(payout.amount),
        status: payout.status,
        reference: payout.reference,
        note: payout.note,
      })),
  };
}

function inventoryFor(scope: Scope, trucks: Truck[], from: string, to: string) {
  const ids = new Set(trucks.map((truck) => truck.id));
  const movements = scope.world.movements.filter((movement) => ids.has(movement.truckId));
  const prior = reconcileInventory(movements.filter((movement) => movement.date < from));
  const opening = new Map(prior.map((row) => [`${row.truckId}|${row.productId}`, row.closing]));
  const grouped = new Map<string, InventoryMovement[]>();
  for (const movement of movements.filter((movement) => movement.date >= from && movement.date <= to)) {
    const key = `${movement.truckId}|${movement.productId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), movement]);
  }
  const keys = new Set<string>([...opening.keys(), ...grouped.keys()]);
  return [...keys]
    .map((key) => {
      const [truckId, productId] = key.split("|");
      const list = grouped.get(key) ?? [];
      const total = (type: InventoryMovement["type"]) => list.filter((movement) => movement.type === type).reduce((sum, movement) => sum + movement.quantity, 0);
      const openQty = (opening.get(key) ?? 0) + total("opening");
      const received = total("received");
      const sold = total("sold");
      const donated = total("donated");
      const wasted = total("wasted");
      const returned = total("returned");
      const transferredOut = total("transferred_out");
      const transferredIn = total("transferred_in");
      const closing = openQty + received - sold - donated - wasted - returned - transferredOut + transferredIn;
      return {
        truckId,
        productId,
        truck: truckName(scope, truckId),
        product: productName(scope.world, productId),
        opening: openQty,
        received,
        sold,
        donated,
        wasted,
        returned,
        transferredOut,
        transferredIn,
        closing,
        balanced: true,
      };
    })
    .filter((row) => trucks.some((truck) => truck.id === row.truckId))
    .sort((a, b) => a.truck.localeCompare(b.truck) || a.product.localeCompare(b.product));
}

export async function getTrucks(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const current = rangePortfolio(scope, trucks, filters.from, filters.to);
  const stock = inventoryFor(scope, trucks, filters.from, filters.to);
  return trucks.map((truck) => {
    const part = current.parts.find((item) => item.truckId === truck.id);
    const agreement = scope.investments.find((investment) => investment.truckId === truck.id);
    const rows = stock.filter((row) => row.truckId === truck.id);
    const sum = (read: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + read(row), 0);
    return {
      id: truck.id,
      code: truck.code,
      name: truck.name,
      location: `${truck.location}, ${truck.district}`,
      status: truck.status,
      statusNote: truck.statusNote,
      dispatched: sum((row) => row.received),
      sold: part?.mealsSold ?? 0,
      donated: sum((row) => row.donated),
      returned: sum((row) => row.returned),
      wasted: sum((row) => row.wasted),
      stock: sum((row) => row.closing),
      revenue: money(part?.eligibleSales ?? ZERO),
      expenses: money((part?.operatingExpenses ?? ZERO) + (part?.otherCosts ?? ZERO) + (part?.cogs ?? ZERO)),
      charity: money(part?.charityAllocation ?? ZERO),
      profit: money(part?.distributableProfit ?? ZERO),
      earnings: money(part && agreement ? shareOfProfit(part.distributableProfit, agreement.entitlementBps) : ZERO),
      entitlement: formatBps(agreement?.entitlementBps ?? 0),
    };
  });
}

export async function getTruckDetail(investorId: string, id: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const truck = scope.trucks.find((item) => item.id === id);
  if (!truck) return null;
  const summary = (await getTrucks(investorId, { ...filters, truck: id }))?.[0];
  if (!summary) return null;
  const months = chartSlices(filters.from, filters.to).map((slice) => {
    const portfolio = rangePortfolio(scope, [truck], slice.start, slice.end);
    const stock = inventoryFor(scope, [truck], slice.start, slice.end);
    return {
      label: formatChartLabel(slice.start, slice.end),
      sales: portfolio.eligible,
      received: stock.reduce((total, row) => total + row.received, 0),
      sold: stock.reduce((total, row) => total + row.sold, 0),
      donated: stock.reduce((total, row) => total + row.donated, 0),
      wasted: stock.reduce((total, row) => total + row.wasted, 0),
      returned: stock.reduce((total, row) => total + row.returned, 0),
    };
  });
  return {
    ...summary,
    reserve: formatBps(truck.reserveBps),
    fssai: truck.fssai,
    gstin: truck.gstin,
    latitude: truck.latitude,
    longitude: truck.longitude,
    months: months.map((month) => ({
      label: month.label,
      sales: money(month.sales).chart,
      received: month.received,
      sold: month.sold,
      donated: month.donated,
      wasted: month.wasted,
      returned: month.returned,
    })),
    inventory: inventoryFor(scope, [truck], filters.from, filters.to),
  };
}

export async function getSales(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const ids = new Set(trucks.map((truck) => truck.id));
  const sales = scope.world.sales.filter((sale) => {
    if (!ids.has(sale.truckId) || sale.date < filters.from || sale.date > filters.to) return false;
    if (filters.category !== "all" && productCategory(scope.world, sale.productId) !== filters.category) return false;
    if (filters.q && !`${productName(scope.world, sale.productId)} ${sale.reference}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    return true;
  });
  const eligible = sumFils(sales.map((sale) => sale.eligible));
  const meals = sales.reduce((total, sale) => total + sale.quantity, 0);
  const byDay = new Map<string, Fils>();
  const byCategory = new Map<string, Fils>();
  const byProduct = new Map<string, { quantity: number; eligible: Fils }>();
  const byTruck = new Map<string, Fils>();
  for (const sale of sales) {
    byDay.set(sale.date, (byDay.get(sale.date) ?? ZERO) + sale.eligible);
    const category = productCategory(scope.world, sale.productId);
    byCategory.set(category, (byCategory.get(category) ?? ZERO) + sale.eligible);
    const product = byProduct.get(sale.productId) ?? { quantity: 0, eligible: ZERO };
    product.quantity += sale.quantity;
    product.eligible += sale.eligible;
    byProduct.set(sale.productId, product);
    byTruck.set(sale.truckId, (byTruck.get(sale.truckId) ?? ZERO) + sale.eligible);
  }
  const table = sales
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((sale) => ({
      date: formatLongDate(sale.date),
      product: productName(scope.world, sale.productId),
      truck: truckName(scope, sale.truckId),
      quantity: sale.quantity,
      price: money(sale.unitPrice),
      discount: money(sale.discount),
      refund: money(sale.refund),
      eligible: money(sale.eligible),
      charity: money(sale.charity),
      reference: sale.reference,
    }));
  return {
    gross: money(sumFils(sales.map((sale) => sale.gross))),
    discounts: money(sumFils(sales.map((sale) => sale.discount))),
    refunds: money(sumFils(sales.map((sale) => sale.refund))),
    eligible: money(eligible),
    charity: money(sumFils(sales.map((sale) => sale.charity))),
    meals,
    average: meals > 0 ? money(mulDiv(eligible, 1n, BigInt(meals))) : money(ZERO),
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ label: date.slice(5), revenue: money(amount).chart })),
    monthly: chartSlices(filters.from, filters.to).map((slice) => ({
      label: formatChartLabel(slice.start, slice.end),
      revenue: money(sumFils(sales.filter((sale) => sale.date >= slice.start && sale.date <= slice.end).map((sale) => sale.eligible))).chart,
    })),
    categories: [...byCategory.entries()].map(([name, amount]) => ({ name, value: money(amount).chart })),
    trucks: [...byTruck.entries()].map(([id, amount]) => ({ name: truckName(scope, id).replace(" · ", " "), value: money(amount).chart })),
    top: [...byProduct.entries()]
      .sort((a, b) => (a[1].eligible < b[1].eligible ? 1 : -1))
      .slice(0, 5)
      .map(([id, row]) => ({ name: productName(scope.world, id), quantity: row.quantity, revenue: money(row.eligible).chart })),
    table: paginate(table, filters.page, filters.pageSize),
    categoriesList: [...new Set(scope.world.products.map((product) => product.category))],
  };
}

export async function getInventory(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const rows = inventoryFor(scope, trucks, filters.from, filters.to).filter((row) => {
    if (!filters.q) return true;
    return `${row.product} ${row.truck}`.toLowerCase().includes(filters.q.toLowerCase());
  });
  const sum = (read: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + read(row), 0);
  return {
    dispatched: sum((row) => row.received),
    received: sum((row) => row.received),
    sold: sum((row) => row.sold),
    donated: sum((row) => row.donated),
    returned: sum((row) => row.returned),
    wasted: sum((row) => row.wasted),
    closing: sum((row) => row.closing),
    table: paginate(rows, filters.page, filters.pageSize),
  };
}

export async function getInventoryDrill(investorId: string, truckId: string, productId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope || !scope.truckIds.has(truckId)) return null;
  const row = inventoryFor(scope, scope.trucks.filter((truck) => truck.id === truckId), filters.from, filters.to).find((item) => item.productId === productId);
  if (!row) return null;
  const movements = scope.world.movements
    .filter((movement) => movement.truckId === truckId && movement.productId === productId && movement.date >= filters.from && movement.date <= filters.to)
    .map((movement) => ({
      id: movement.id,
      date: formatLongDate(movement.date),
      type: movement.type.replaceAll("_", " "),
      quantity: movement.quantity,
      reference: movement.reference,
      note: movement.note,
    }));
  return { row, movements };
}

export async function getProfit(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const current = rangePortfolio(scope, trucks, filters.from, filters.to);
  const prior = filters.previous ? rangePortfolio(scope, trucks, filters.previous.from, filters.previous.to) : null;
  const ledger = scope.world.earnings
    .filter((earning) => earning.investorId === investorId && trucks.some((truck) => truck.id === earning.truckId) && earning.periodEnd >= filters.from && earning.periodStart <= filters.to)
    .map((earning) => {
      const profit = scope.world.profits.find((item) => item.periodId === earning.periodId);
      const snapshot = scope.world.snapshots.find((item) => item.periodId === earning.periodId);
      const payouts = scope.world.payouts.filter((payout) => payout.investorId === investorId && payout.periodId === earning.periodId && payout.investmentId === earning.investmentId);
      const paid = sumFils(payouts.filter((payout) => payout.status === "paid").map((payout) => payout.amount));
      const outstanding = sumFils(payouts.filter((payout) => payout.status === "approved").map((payout) => payout.amount));
      return {
        truck: truckName(scope, earning.truckId),
        period: formatMonth(earning.periodStart.slice(0, 7)),
        status: earning.periodStatus,
        revenue: money(profit?.eligibleSales ?? ZERO),
        charity: money(profit?.charityAllocation ?? ZERO),
        direct: money(profit?.cogs ?? ZERO),
        operating: money(profit?.operatingExpenses ?? ZERO),
        operatingProfit: money(profit?.operatingProfit ?? ZERO),
        distributable: money(profit?.distributableProfit ?? ZERO),
        share: money(earning.shareBeforeCarryforward),
        carryforward: money(earning.carryforwardApplied),
        earned: money(earning.earnedProfit),
        approved: money(earning.approvedEarnings),
        paid: money(paid),
        outstanding: money(outstanding),
        lossCarryforward: earning.lossCarryforwardEnabled,
        snapshotNote: snapshot
          ? snapshot.distributableProfit === profit?.distributableProfit
            ? "Live calculation matches the finalized snapshot."
            : "Live calculation differs from the stored snapshot. Review controlled adjustments."
          : "This period is open, so no snapshot has been stored.",
        audit: (profit?.audit ?? []).map((line) => ({ step: line.step, detail: line.detail, amount: money(line.amount) })),
        adjustments: scope.world.adjustments
          .filter((adjustment) => adjustment.periodId === earning.periodId)
          .map((adjustment) => ({ reference: adjustment.reference, reason: adjustment.reason, amount: money(adjustment.distributableDelta), date: formatLongDate(adjustment.date) })),
      };
    });
  const steps = [
    { label: "Eligible sales", amount: current.eligible, kind: "total" as const },
    { label: "Charity allocation (20%)", amount: current.charity, kind: "decrease" as const },
    { label: "Food costs", amount: current.cogs, kind: "decrease" as const },
    { label: "Operating expenses", amount: current.operating, kind: "decrease" as const },
    { label: "Other costs and reserves", amount: current.other + current.reserves, kind: "decrease" as const },
    { label: "Controlled adjustments", amount: current.adjustments, kind: current.adjustments < 0n ? "decrease" as const : "increase" as const },
    { label: "Distributable profit", amount: current.distributable, kind: "result" as const },
    { label: "Your earnings", amount: current.investorShare, kind: "gold" as const },
  ];
  return {
    steps: steps.map((step) => ({ ...step, amount: money(step.amount) })),
    comparison: {
      revenue: { current: money(current.eligible), delta: deltaFor(current.eligible, prior?.eligible ?? null, filters.comparable) },
      profit: { current: money(current.distributable), delta: deltaFor(current.distributable, prior?.distributable ?? null, filters.comparable) },
      earnings: { current: money(current.investorShare), delta: deltaFor(current.investorShare, prior?.investorShare ?? null, filters.comparable) },
    },
    yearly: {
      revenue: money(sumFils(ledger.map((row) => BigInt(row.revenue.fils)))),
      distributable: money(sumFils(ledger.map((row) => BigInt(row.distributable.fils)))),
      earned: money(sumFils(ledger.map((row) => BigInt(row.earned.fils)))),
      approved: money(sumFils(ledger.map((row) => BigInt(row.approved.fils)))),
      paid: money(sumFils(ledger.map((row) => BigInt(row.paid.fils)))),
    },
    ledger,
    valid: current.parts.every((part) => part.allocationValid),
  };
}

export async function getCharity(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const current = rangePortfolio(scope, trucks, filters.from, filters.to);
  const uses = scope.world.charityUses.filter((use) => trucks.some((truck) => truck.id === use.truckId) && use.date >= filters.from && use.date <= filters.to);
  const used = sumFils(uses.map((use) => use.amount));
  const meals = (status: string) => uses.filter((use) => use.status === status).reduce((total, use) => total + use.meals, 0);
  const mealCount = uses.reduce((total, use) => total + use.meals, 0);
  const months = chartSlices(filters.from, filters.to).map((slice) => {
    const portfolio = rangePortfolio(scope, trucks, slice.start, slice.end);
    const monthUses = uses.filter((use) => use.date >= slice.start && use.date <= slice.end);
    return {
      label: formatChartLabel(slice.start, slice.end),
      allocated: money(portfolio.charity).chart,
      used: money(sumFils(monthUses.map((use) => use.amount))).chart,
      distributed: monthUses.filter((use) => use.status === "distributed").reduce((total, use) => total + use.meals, 0),
    };
  });
  return {
    eligible: money(current.eligible),
    allocated: money(current.charity),
    used: money(used),
    remaining: money(current.charity - used),
    attributed: money(current.attributedCharity),
    costs: money(current.cogs + current.operating + current.other),
    reserves: money(current.reserves),
    distributable: money(current.distributable),
    earnings: money(current.investorShare),
    sponsored: meals("sponsored"),
    prepared: meals("prepared"),
    distributed: meals("distributed"),
    average: mealCount > 0 ? money(mulDiv(used, 1n, BigInt(mealCount))) : null,
    months,
    history: uses
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((use) => ({
        id: use.id,
        date: formatLongDate(use.date),
        truck: truckName(scope, use.truckId),
        status: use.status,
        meals: use.meals,
        amount: money(use.amount),
        reference: use.reference,
        note: use.note,
      })),
  };
}

export async function getTransactions(investorId: string, filters: Filters) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const trucks = selectedTrucks(scope, filters.truck);
  const rows = transactionsFor(scope, trucks, filters.from, filters.to).filter((row) => {
    if (filters.type !== "all" && row.type.toLowerCase() !== filters.type.toLowerCase()) return false;
    if (filters.status !== "all" && !row.status.toLowerCase().includes(filters.status.toLowerCase())) return false;
    if (!filters.q) return true;
    const haystack = `${row.id} ${row.description} ${row.reference} ${row.truck} ${row.type}`.toLowerCase();
    return haystack.includes(filters.q.toLowerCase());
  });
  return paginate(rows, filters.page, filters.pageSize);
}

export async function getNotifications(investorId: string, filters: Filters, readIds: string[]) {
  const scope = await getScope(investorId);
  if (!scope) return null;
  const read = new Set(readIds);
  const items = scope.world.notifications
    .filter((item) => item.investorId === investorId)
    .map((item) => ({ ...item, unread: isSupabaseMode() ? item.unread : item.unread && !read.has(item.id), createdLabel: formatLongDate(item.createdOn) }))
    .filter((item) => (filters.notice === "unread" ? item.unread : true))
    .sort((a, b) => (a.createdOn < b.createdOn ? 1 : -1));
  return { items, unread: items.filter((item) => item.unread).length };
}

export async function unreadCount(investorId: string, readIds: string[]): Promise<number> {
  const data = await getNotifications(investorId, { ...parseFilters({}), notice: "all" }, readIds);
  return data?.items.filter((item) => item.unread).length ?? 0;
}

export interface BellNotice {
  id: string;
  title: string;
  body: string;
  href: string;
  unread: boolean;
  createdLabel: string;
}

export interface BellOrderMenu {
  trucks: Array<{ name: string; location: string }>;
  products: Array<{ name: string; paise: number }>;
}

export async function getBellFeed(investorId: string, readIds: string[]): Promise<{ notices: BellNotice[]; unread: number; orders: BellOrderMenu }> {
  const data = await getNotifications(investorId, { ...parseFilters({}), notice: "all" }, readIds);
  const scope = await getScope(investorId);
  const active = scope?.trucks.filter((truck) => truck.status === "active") ?? [];
  const trucks = (active.length > 0 ? active : scope?.trucks ?? []).map((truck) => ({ name: truck.name, location: truck.location }));
  return {
    notices: (data?.items ?? []).slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      href: item.href,
      unread: item.unread,
      createdLabel: item.createdLabel,
    })),
    unread: data?.unread ?? 0,
    orders: {
      trucks,
      products: (scope?.world.products ?? []).map((product) => ({ name: product.name, paise: Number(product.unitPrice) })),
    },
  };
}

export async function filterChoices(investorId: string) {
  const scope = await getScope(investorId);
  if (!scope) return { trucks: [], categories: [] };
  return {
    trucks: scope.trucks.map((truck) => ({ id: truck.id, label: `Truck ${truck.code} · ${truck.name}` })),
    categories: [...new Set(scope.world.products.map((product) => product.category))],
  };
}

export type OverviewData = NonNullable<Awaited<ReturnType<typeof getOverview>>>;
export type SalesData = NonNullable<Awaited<ReturnType<typeof getSales>>>;
export type ProfitData = NonNullable<Awaited<ReturnType<typeof getProfit>>>;
export type CharityData = NonNullable<Awaited<ReturnType<typeof getCharity>>>;
export type { Delta as DeltaView, MoneyView };
