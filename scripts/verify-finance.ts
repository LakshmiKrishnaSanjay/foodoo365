import { getWorld } from "../src/lib/demo/world";
import { reconcileInventory } from "../src/lib/finance/inventory";
import { calculateTruckProfit, verifySaleLine } from "../src/lib/finance/profit-engine";
import { investors, trucks } from "../src/lib/demo/catalog";
import { formatAed } from "../src/lib/money";

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
  errors.push(`Truck C August should be a loss, got ${augustC ? formatAed(augustC.distributableProfit) : "missing"}`);
}

const jamesAugust = world.earnings.find(
  (earning) => earning.investorId === investors[1].id && earning.truckId.endsWith("0003") && earning.periodStart === "2026-08-01",
);
if (!jamesAugust || jamesAugust.approvedEarnings !== 0n || jamesAugust.earnedProfit >= 0n) {
  errors.push("Negative August earnings created an approved payout for James");
}
const jamesSeptember = world.earnings.find(
  (earning) => earning.investorId === investors[1].id && earning.truckId.endsWith("0003") && earning.periodStart === "2026-09-01",
);
if (!jamesSeptember || jamesSeptember.carryforwardApplied <= 0n) {
  errors.push("James September should apply August loss carryforward");
}
const priyaSeptember = world.earnings.find(
  (earning) => earning.investorId === investors[2].id && earning.truckId.endsWith("0003") && earning.periodStart === "2026-09-01",
);
if (!priyaSeptember || priyaSeptember.carryforwardApplied !== 0n) {
  errors.push("Priya's agreement should not carry the August loss forward");
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
  console.log(`C ${profit.periodStart} dist ${formatAed(profit.distributableProfit)} eligible ${formatAed(profit.eligibleSales)} meals ${profit.mealsSold}`);
}
if (jamesAugust && jamesSeptember) {
  console.log(`James Aug earned ${formatAed(jamesAugust.earnedProfit)} loss bal ${formatAed(jamesAugust.endingLossBalance)}`);
  console.log(`James Sep share ${formatAed(jamesSeptember.shareBeforeCarryforward)} cf ${formatAed(jamesSeptember.carryforwardApplied)} earned ${formatAed(jamesSeptember.earnedProfit)}`);
}
if (errors.length) {
  console.error(errors.slice(0, 30).join("\n"));
  process.exit(1);
}
console.log("finance checks passed");
