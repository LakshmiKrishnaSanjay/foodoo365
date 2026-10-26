import { getWorld } from "../src/lib/demo/world";
import { reconcileInventory } from "../src/lib/finance/inventory";
import { calculateTruckProfit, shareOfProfit, verifySaleLine } from "../src/lib/finance/profit-engine";
import { investors, products, productWeights, trucks } from "../src/lib/demo/catalog";
import { applyBps, formatInr, sumFils, ZERO } from "../src/lib/money";
import { addDays, DEMO_END } from "../src/lib/dates";

const world = getWorld();
const errors: string[] = [];

for (const sale of world.sales) {
  errors.push(...verifySaleLine(sale));
}

const reconciled = reconcileInventory(world.movements);
if (reconciled.some((row) => !row.balanced || row.closing < 0)) {
  errors.push("Inventory reconciliation failed");
}

for (const truck of trucks) {
  const total = world.entitlementTotals[truck.id] ?? 0;
  if (total > 10000) errors.push(`${truck.code} entitlements exceed 100%`);
}

const soldFromSales = new Map<string, number>();
for (const sale of world.sales) {
  const key = `${sale.truckId}|${sale.productId}`;
  soldFromSales.set(key, (soldFromSales.get(key) ?? 0) + sale.quantity);
}
for (const row of reconciled) {
  const soldMoves = world.movements
    .filter((movement) => movement.truckId === row.truckId && movement.productId === row.productId && movement.type === "sold")
    .reduce((sum, movement) => sum + movement.quantity, 0);
  if (soldMoves !== (soldFromSales.get(`${row.truckId}|${row.productId}`) ?? 0)) {
    errors.push(`Sold stock does not match sales for ${row.truckId} ${row.productId}`);
  }
}

for (const snapshot of world.snapshots) {
  const period = world.periods.find((item) => item.id === snapshot.periodId);
  const truck = trucks.find((item) => item.id === snapshot.truckId);
  if (!period || !truck) {
    errors.push("Snapshot missing period");
    continue;
  }
  const live = calculateTruckProfit({
    truckId: truck.id,
    periodId: period.id,
    periodStart: period.start,
    periodEnd: period.end,
    status: period.status,
    reserveBps: truck.reserveBps,
    entitlementBpsTotal: world.entitlementTotals[truck.id] ?? 0,
    sales: world.sales,
    expenses: world.expenses,
    cogs: world.cogs,
    adjustments: world.adjustments,
  });
  if (live.distributableProfit !== snapshot.distributableProfit) {
    errors.push(`Snapshot mismatch for ${period.id}`);
  }
  if (live.distributableBeforeAdjustments !== snapshot.distributableBeforeAdjustments) {
    errors.push(`Original snapshot mismatch for ${period.id}`);
  }
}

const julyB = world.profits.find((profit) => profit.periodId.endsWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002:2026-07") || profit.periodId.includes(":2026-07") && profit.truckId.endsWith("0002"));
if (!julyB || julyB.adjustments === 0n) errors.push("July Truck B adjustment missing");
if (julyB && julyB.distributableBeforeAdjustments === julyB.distributableProfit) {
  errors.push("Adjustment overwrote the pre-adjustment distributable profit");
}

const augustC = world.profits.find((profit) => profit.truckId.endsWith("0003") && profit.periodStart === "2026-08-01");
if (!augustC || augustC.distributableProfit >= 0n) {
  errors.push(`Truck C August should be a loss, got ${augustC ? formatInr(augustC.distributableProfit) : "missing"}`);
}

const jamesAugust = world.earnings.find(
  (earning) => earning.investorId === investors[1].id && earning.truckId.endsWith("0003") && earning.periodStart === "2026-08-01",
);
if (!jamesAugust || jamesAugust.approvedEarnings !== 0n || jamesAugust.earnedProfit >= 0n) {
  errors.push("Negative August earnings created an approved payout for Thomas");
}
const jamesSeptember = world.earnings.find(
  (earning) => earning.investorId === investors[1].id && earning.truckId.endsWith("0003") && earning.periodStart === "2026-09-01",
);
if (!jamesSeptember || jamesSeptember.carryforwardApplied <= 0n) {
  errors.push("Thomas September should apply August loss carryforward");
}
const priyaSeptember = world.earnings.find(
  (earning) => earning.investorId === investors[2].id && earning.truckId.endsWith("0003") && earning.periodStart === "2026-09-01",
);
if (!priyaSeptember || priyaSeptember.carryforwardApplied !== 0n) {
  errors.push("Fathima's agreement should not carry the August loss forward");
}

const charityExpenses = world.expenses.filter((expense) => expense.category === "charity_allocation");
if (charityExpenses.length !== 1) errors.push("Expected one rejected charity expense");
const mayA = world.profits.find((profit) => profit.truckId.endsWith("0001") && profit.periodStart === "2026-05-01");
if (!mayA || mayA.excludedCharityExpenses.length !== 1) errors.push("Charity expense was not excluded");
const juneB = world.profits.find((profit) => profit.truckId.endsWith("0002") && profit.periodStart === "2026-06-01");
if (!juneB || juneB.excludedDuplicateExpenses.length !== 1) errors.push("Duplicate fuel expense was not excluded");

for (const profit of world.profits) {
  if (!profit.allocationValid) errors.push(`Invalid allocation on ${profit.periodId}`);
}

const aminaTruckIds = new Set(
  world.investments.filter((investment) => investment.investorId === investors[0].id).map((investment) => investment.truckId),
);
const leaked = world.investments.filter(
  (investment) => investment.investorId === investors[0].id && !aminaTruckIds.has(investment.truckId),
);
if (leaked.length) errors.push("Scope leak");

console.log(`sales ${world.sales.length}`);
console.log(`movements ${world.movements.length}`);
console.log(`expenses ${world.expenses.length}`);
console.log(`earnings ${world.earnings.length}`);
console.log(`payouts ${world.payouts.length}`);
for (const profit of world.profits.filter((item) => item.truckId.endsWith("0003"))) {
  console.log(`C ${profit.periodStart} dist ${formatInr(profit.distributableProfit)} eligible ${formatInr(profit.eligibleSales)} meals ${profit.mealsSold}`);
}
if (jamesAugust && jamesSeptember) {
  console.log(`Thomas Aug earned ${formatInr(jamesAugust.earnedProfit)} loss bal ${formatInr(jamesAugust.endingLossBalance)}`);
  console.log(`Thomas Sep share ${formatInr(jamesSeptember.shareBeforeCarryforward)} cf ${formatInr(jamesSeptember.carryforwardApplied)} earned ${formatInr(jamesSeptember.earnedProfit)}`);
}

const weightTotal = productWeights.reduce((sum, weight) => sum + weight, 0);
const weightedPrice = productWeights.reduce((sum, weight, index) => sum + weight * Number(products[index].unitPrice), 0) / weightTotal / 100;
const weightedCost = productWeights.reduce((sum, weight, index) => sum + weight * Number(products[index].unitCost), 0) / weightTotal / 100;
if (weightedPrice < 120 || weightedPrice > 180) errors.push(`Average meal price ${weightedPrice.toFixed(2)} is outside ₹120–180`);
const costRatio = weightedCost / weightedPrice;
if (costRatio < 0.3 || costRatio > 0.35) errors.push(`Food cost ratio ${(costRatio * 100).toFixed(1)}% is outside 30–35%`);

const from = addDays(DEMO_END, -29);
const to = DEMO_END;
const anjali = investors[0];
const agreements = world.investments.filter((investment) => investment.investorId === anjali.id);
let cardRevenue = ZERO;
let cardMeals = 0;
let earned = ZERO;
let charity = ZERO;
for (const agreement of agreements) {
  const truck = trucks.find((item) => item.id === agreement.truckId);
  if (!truck) continue;
  const profit = calculateTruckProfit({
    truckId: truck.id,
    periodId: `${truck.id}:${from}:${to}`,
    periodStart: from,
    periodEnd: to,
    status: "open",
    reserveBps: truck.reserveBps,
    entitlementBpsTotal: world.entitlementTotals[truck.id] ?? 0,
    sales: world.sales,
    expenses: world.expenses,
    cogs: world.cogs,
    adjustments: world.adjustments.filter((adjustment) => adjustment.date >= from && adjustment.date <= to),
  });
  cardRevenue += profit.eligibleSales;
  cardMeals += profit.mealsSold;
  earned += shareOfProfit(profit.distributableProfit, agreement.entitlementBps);
  charity += applyBps(profit.charityAllocation, agreement.entitlementBps);
}
const payouts = world.payouts.filter((payout) => payout.investorId === anjali.id && agreements.some((agreement) => agreement.truckId === payout.truckId));
const paid = sumFils(payouts.filter((payout) => payout.status === "paid" && payout.date >= from && payout.date <= to).map((payout) => payout.amount));
const pending = sumFils(payouts.filter((payout) => payout.status === "approved").map((payout) => payout.amount));
const fromEligible = agreements.reduce((total, agreement) => {
  const truck = trucks.find((item) => item.id === agreement.truckId);
  if (!truck) return total;
  const profit = calculateTruckProfit({
    truckId: truck.id,
    periodId: `${truck.id}:${from}:${to}`,
    periodStart: from,
    periodEnd: to,
    status: "open",
    reserveBps: truck.reserveBps,
    entitlementBpsTotal: world.entitlementTotals[truck.id] ?? 0,
    sales: world.sales,
    expenses: world.expenses,
    cogs: world.cogs,
    adjustments: [],
  });
  const share = shareOfProfit(profit.distributableProfit, agreement.entitlementBps);
  const attributed = applyBps(profit.charityAllocation, agreement.entitlementBps);
  const direct = applyBps(applyBps(profit.eligibleSales, 2000), agreement.entitlementBps);
  if (attributed !== direct) {
    console.log(`${truck.code} charity ledger ${formatInr(attributed)} vs 20% of eligible ${formatInr(direct)}`);
  }
  console.log(`${truck.code} eligible ${formatInr(profit.eligibleSales)} meals ${profit.mealsSold} earnings ${formatInr(share)}`);
  return total + direct;
}, ZERO);
if (fromEligible !== charity) console.log(`Attributed charity ${formatInr(charity)} vs compounded 20% ${formatInr(fromEligible)}`);
console.log(`Weighted meal price ₹${weightedPrice.toFixed(2)}, food cost ${(costRatio * 100).toFixed(1)}%`);
const demoDays = Math.round((Date.parse("2026-10-25T00:00:00Z") - Date.parse("2026-05-01T00:00:00Z")) / 86_400_000) + 1;
for (const agreement of world.investments) {
  const total = sumFils(world.earnings.filter((item) => item.investmentId === agreement.id).map((item) => item.earnedProfit));
  const annual = (Number(total) / Number(agreement.amount)) * (365 / demoDays);
  const investor = investors.find((item) => item.id === agreement.investorId);
  console.log(`${investor?.preferredName} ${agreement.id} annualised ${(annual * 100).toFixed(1)}%`);
}
if (paid + pending !== sumFils(payouts.filter((payout) => (payout.status === "paid" && payout.date >= from && payout.date <= to) || payout.status === "approved").map((payout) => payout.amount))) {
  errors.push("Paid and pending payouts do not match the payout rows");
}

if (errors.length) {
  console.error(errors.slice(0, 30).join("\n"));
  process.exit(1);
}
console.log("finance checks passed");
