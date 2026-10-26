import { applyBps, maxFils, minFils, sumFils, type Fils, ZERO } from "@/lib/money";
import { CHARITY_BPS } from "@/lib/dates";

export const BLOCKED_EXPENSE_CATEGORIES = new Set([
  "charity",
  "charity_allocation",
  "charity allocation",
]);

export interface SaleFact {
  id: string;
  truckId: string;
  date: string;
  productId: string;
  quantity: number;
  unitPrice: Fils;
  gross: Fils;
  discount: Fils;
  refund: Fils;
  taxCollected: Fils;
  eligible: Fils;
  charity: Fils;
  reference: string;
}

export interface ExpenseFact {
  id: string;
  truckId: string;
  date: string;
  category: string;
  classification: "operating" | "other_cost";
  description: string;
  amount: Fils;
  reference: string;
}

export interface CogsFact {
  truckId: string;
  date: string;
  productId: string;
  quantity: number;
  unitCost: Fils;
  amount: Fils;
}

export interface PeriodAdjustment {
  id: string;
  truckId: string;
  periodId: string;
  date: string;
  reason: string;
  distributableDelta: Fils;
  reference: string;
}

export interface AuditLine {
  step: string;
  detail: string;
  amount: Fils;
}

export interface TruckProfitResult {
  truckId: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  status: "open" | "finalized";
  grossSales: Fils;
  discounts: Fils;
  refunds: Fils;
  taxCollected: Fils;
  eligibleSales: Fils;
  charityAllocation: Fils;
  cogs: Fils;
  operatingExpenses: Fils;
  otherCosts: Fils;
  operatingProfit: Fils;
  reserves: Fils;
  adjustments: Fils;
  distributableBeforeAdjustments: Fils;
  distributableProfit: Fils;
  mealsSold: number;
  entitlementBpsTotal: number;
  allocationValid: boolean;
  excludedDuplicateExpenses: string[];
  excludedCharityExpenses: string[];
  audit: AuditLine[];
}

export interface InvestorEarningResult {
  investmentId: string;
  investorId: string;
  truckId: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  periodStatus: "open" | "finalized";
  entitlementBps: number;
  shareBeforeCarryforward: Fils;
  carryforwardApplied: Fils;
  earnedProfit: Fils;
  endingLossBalance: Fils;
  approvedEarnings: Fils;
  lossCarryforwardEnabled: boolean;
}

export interface ProfitEngineInput {
  truckId: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  status: "open" | "finalized";
  reserveBps: number;
  entitlementBpsTotal: number;
  sales: SaleFact[];
  expenses: ExpenseFact[];
  cogs: CogsFact[];
  adjustments: PeriodAdjustment[];
}

export function partitionExpenses(expenses: ExpenseFact[]): {
  kept: ExpenseFact[];
  duplicateIds: string[];
  charityIds: string[];
} {
  const seen = new Set<string>();
  const kept: ExpenseFact[] = [];
  const duplicateIds: string[] = [];
  const charityIds: string[] = [];

  for (const expense of expenses) {
    if (BLOCKED_EXPENSE_CATEGORIES.has(expense.category.trim().toLowerCase())) {
      charityIds.push(expense.id);
      continue;
    }
    const key = [
      expense.truckId,
      expense.date,
      expense.category,
      expense.reference,
      expense.amount.toString(),
    ].join("|");
    if (seen.has(key)) {
      duplicateIds.push(expense.id);
      continue;
    }
    seen.add(key);
    kept.push(expense);
  }

  return { kept, duplicateIds, charityIds };
}

export function calculateTruckProfit(input: ProfitEngineInput): TruckProfitResult {
  const sales = input.sales.filter(
    (sale) => sale.truckId === input.truckId && sale.date >= input.periodStart && sale.date <= input.periodEnd,
  );
  const cogsRows = input.cogs.filter(
    (row) => row.truckId === input.truckId && row.date >= input.periodStart && row.date <= input.periodEnd,
  );
  const { kept, duplicateIds, charityIds } = partitionExpenses(
    input.expenses.filter(
      (expense) =>
        expense.truckId === input.truckId && expense.date >= input.periodStart && expense.date <= input.periodEnd,
    ),
  );
  const adjustments = input.adjustments.filter(
    (adjustment) =>
      adjustment.truckId === input.truckId &&
      adjustment.periodId === input.periodId,
  );

  const grossSales = sumFils(sales.map((sale) => sale.gross));
  const discounts = sumFils(sales.map((sale) => sale.discount));
  const refunds = sumFils(sales.map((sale) => sale.refund));
  const taxCollected = sumFils(sales.map((sale) => sale.taxCollected));
  const eligibleSales = sumFils(sales.map((sale) => sale.eligible));
  const charityAllocation = sumFils(sales.map((sale) => sale.charity));
  const cogs = sumFils(cogsRows.map((row) => row.amount));
  const operatingExpenses = sumFils(
    kept.filter((expense) => expense.classification === "operating").map((expense) => expense.amount),
  );
  const otherCosts = sumFils(
    kept.filter((expense) => expense.classification === "other_cost").map((expense) => expense.amount),
  );
  const operatingProfit = eligibleSales - charityAllocation - cogs - operatingExpenses - otherCosts;
  const reserves = operatingProfit > 0n ? applyBps(operatingProfit, input.reserveBps) : ZERO;
  const distributableBeforeAdjustments = operatingProfit - reserves;
  const adjustmentTotal = sumFils(adjustments.map((adjustment) => adjustment.distributableDelta));
  const distributableProfit = distributableBeforeAdjustments + adjustmentTotal;
  const mealsSold = sales.reduce((total, sale) => total + sale.quantity, 0);
  const allocationValid = input.entitlementBpsTotal >= 0 && input.entitlementBpsTotal <= 10000;

  const audit: AuditLine[] = [
    { step: "Gross menu sales", detail: "Tax-exclusive menu value before discounts and refunds.", amount: grossSales },
    { step: "Discounts", detail: "Deducted from eligible sales. Not treated as profit.", amount: discounts },
    { step: "Refunds", detail: "Deducted from eligible sales.", amount: refunds },
    {
      step: "Tax collected",
      detail: "GST collected for the authorities. Excluded from eligible sales and from profit.",
      amount: taxCollected,
    },
    {
      step: "Eligible sales",
      detail: "Gross sales minus discounts and refunds. Profit is never calculated on unsold inventory.",
      amount: eligibleSales,
    },
    {
      step: "Charity allocation",
      detail: "20% of each sale line's eligible amount, summed from the charity ledger. Not recorded again as an expense.",
      amount: charityAllocation,
    },
    { step: "Cost of goods sold", detail: "Unit cost multiplied by meals sold. Unsold stock is excluded.", amount: cogs },
    { step: "Operating expenses", detail: "Approved operating costs for the period, after duplicate removal.", amount: operatingExpenses },
    { step: "Other approved costs", detail: "Contractual costs such as card processing fees.", amount: otherCosts },
    { step: "Operating profit", detail: "Eligible sales minus charity, food cost, operating expenses and other costs.", amount: operatingProfit },
    {
      step: "Reserves",
      detail:
        input.reserveBps === 0
          ? "No operating reserve applies to this truck."
          : `${(input.reserveBps / 100).toFixed(2)}% of positive operating profit is retained as a reserve. Losses do not create a negative reserve.`,
      amount: reserves,
    },
    {
      step: "Distributable before adjustments",
      detail: "Operating profit after reserves. Finalized periods keep this figure.",
      amount: distributableBeforeAdjustments,
    },
    {
      step: "Controlled adjustments",
      detail:
        adjustments.length === 0
          ? "No post-close adjustments."
          : adjustments.map((adjustment) => `${adjustment.reference}: ${adjustment.reason}`).join(" "),
      amount: adjustmentTotal,
    },
    {
      step: "Distributable profit",
      detail: "Amount available to contracted profit entitlements. A negative result does not create a payout.",
      amount: distributableProfit,
    },
  ];

  if (duplicateIds.length > 0) {
    audit.push({
      step: "Duplicate expenses excluded",
      detail: `${duplicateIds.length} duplicate expense ${duplicateIds.length === 1 ? "entry was" : "entries were"} ignored.`,
      amount: ZERO,
    });
  }
  if (charityIds.length > 0) {
    audit.push({
      step: "Charity expenses excluded",
      detail: "Charity was already deducted from eligible sales, so charity expense lines were rejected.",
      amount: ZERO,
    });
  }
  if (!allocationValid) {
    audit.push({
      step: "Allocation check failed",
      detail: `Contracted entitlements total ${(input.entitlementBpsTotal / 100).toFixed(2)}%, which is outside 0–100%.`,
      amount: ZERO,
    });
  }

  return {
    truckId: input.truckId,
    periodId: input.periodId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: input.status,
    grossSales,
    discounts,
    refunds,
    taxCollected,
    eligibleSales,
    charityAllocation,
    cogs,
    operatingExpenses,
    otherCosts,
    operatingProfit,
    reserves,
    adjustments: adjustmentTotal,
    distributableBeforeAdjustments,
    distributableProfit,
    mealsSold,
    entitlementBpsTotal: input.entitlementBpsTotal,
    allocationValid,
    excludedDuplicateExpenses: duplicateIds,
    excludedCharityExpenses: charityIds,
    audit,
  };
}

export function shareOfProfit(distributable: Fils, entitlementBps: number): Fils {
  return applyBps(distributable, entitlementBps);
}

export function applyLossCarryforward(input: {
  share: Fils;
  openingLoss: Fils;
  enabled: boolean;
}): { earnedProfit: Fils; carryforwardApplied: Fils; endingLossBalance: Fils } {
  const opening = input.openingLoss > 0n ? input.openingLoss : ZERO;
  if (!input.enabled) {
    return { earnedProfit: input.share, carryforwardApplied: ZERO, endingLossBalance: ZERO };
  }
  if (input.share >= 0n) {
    const applied = minFils(opening, input.share);
    return {
      earnedProfit: input.share - applied,
      carryforwardApplied: applied,
      endingLossBalance: opening - applied,
    };
  }
  return {
    earnedProfit: input.share,
    carryforwardApplied: ZERO,
    endingLossBalance: opening + (input.share < 0n ? -input.share : ZERO),
  };
}

export function approvedAmount(earned: Fils, periodStatus: "open" | "finalized"): Fils {
  if (periodStatus !== "finalized") return ZERO;
  return maxFils(earned, ZERO);
}

export function verifySaleLine(sale: SaleFact): string[] {
  const errors: string[] = [];
  const eligible = sale.gross - sale.discount - sale.refund;
  if (sale.eligible !== eligible) errors.push(`${sale.id} eligible revenue does not match gross - discount - refund`);
  if (sale.taxCollected < 0n) errors.push(`${sale.id} tax cannot be negative`);
  if (sale.eligible < 0n) errors.push(`${sale.id} eligible revenue cannot be negative`);
  const expectedCharity = applyBps(sale.eligible, CHARITY_BPS);
  if (sale.charity !== expectedCharity) errors.push(`${sale.id} charity allocation is not 20% of eligible sales`);
  if (sale.gross !== sale.unitPrice * BigInt(sale.quantity)) errors.push(`${sale.id} gross does not match quantity times price`);
  return errors;
}
