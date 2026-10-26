import { ZERO } from "@/lib/money";
import type { AccountingPeriod, Investment, ProfitSnapshot, Truck } from "@/lib/domain";
import {
  applyLossCarryforward,
  approvedAmount,
  calculateTruckProfit,
  shareOfProfit,
  type CogsFact,
  type ExpenseFact,
  type InvestorEarningResult,
  type PeriodAdjustment,
  type SaleFact,
  type TruckProfitResult,
} from "@/lib/finance/profit-engine";

export function deriveFinancials(input: {
  trucks: Truck[];
  investments: Investment[];
  sales: SaleFact[];
  expenses: ExpenseFact[];
  cogs: CogsFact[];
  adjustments: PeriodAdjustment[];
  periods: AccountingPeriod[];
  entitlementTotals: Record<string, number>;
}): {
  profits: TruckProfitResult[];
  earnings: InvestorEarningResult[];
  snapshots: ProfitSnapshot[];
} {
  const profits = input.periods.map((period) =>
    calculateTruckProfit({
      truckId: period.truckId,
      periodId: period.id,
      periodStart: period.start,
      periodEnd: period.end,
      status: period.status,
      reserveBps: input.trucks.find((truck) => truck.id === period.truckId)?.reserveBps ?? 0,
      entitlementBpsTotal: input.entitlementTotals[period.truckId] ?? 0,
      sales: input.sales,
      expenses: input.expenses,
      cogs: input.cogs,
      adjustments: input.adjustments,
    }),
  );

  const snapshots: ProfitSnapshot[] = profits
    .filter((profit) => profit.status === "finalized")
    .map((profit) => ({
      periodId: profit.periodId,
      truckId: profit.truckId,
      distributableBeforeAdjustments: profit.distributableBeforeAdjustments,
      distributableProfit: profit.distributableProfit,
      storedOn: input.periods.find((period) => period.id === profit.periodId)?.finalizedOn ?? profit.periodEnd,
      note: "Immutable snapshot taken when the period was finalized. Later changes are stored as controlled adjustments.",
    }));

  const earnings: InvestorEarningResult[] = [];
  for (const investment of input.investments) {
    let openingLoss = ZERO;
    const truckPeriods = input.periods.filter((period) => period.truckId === investment.truckId);
    for (const period of truckPeriods) {
      const profit = profits.find((item) => item.periodId === period.id);
      if (!profit) continue;
      const share = shareOfProfit(profit.distributableProfit, investment.entitlementBps);
      const carried = applyLossCarryforward({
        share,
        openingLoss,
        enabled: investment.lossCarryforward,
      });
      openingLoss = carried.endingLossBalance;
      earnings.push({
        investmentId: investment.id,
        investorId: investment.investorId,
        truckId: investment.truckId,
        periodId: period.id,
        periodStart: period.start,
        periodEnd: period.end,
        periodStatus: period.status,
        entitlementBps: investment.entitlementBps,
        shareBeforeCarryforward: share,
        carryforwardApplied: carried.carryforwardApplied,
        earnedProfit: carried.earnedProfit,
        endingLossBalance: carried.endingLossBalance,
        approvedEarnings: approvedAmount(carried.earnedProfit, period.status),
        lossCarryforwardEnabled: investment.lossCarryforward,
      });
    }
  }

  return { profits, earnings, snapshots };
}
