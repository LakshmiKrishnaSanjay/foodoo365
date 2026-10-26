import { aed, applyBps, sumFils, ZERO, type Fils } from "@/lib/money";
import { addDays, DEMO_END, DEMO_START, eachDate, isWeekend, monthEnd, monthStart } from "@/lib/dates";
import { CHARITY_BPS, GST_BPS, CARD_FEE_BPS } from "@/lib/dates";
import { type CogsFact, type ExpenseFact, type PeriodAdjustment, type SaleFact } from "@/lib/finance/profit-engine";
import { deriveFinancials } from "@/lib/finance/derive";
import type { InventoryMovement } from "@/lib/finance/inventory";
import type {
  AccountingPeriod,
  CharityUse,
  Payout,
  PortalNotification,
  World,
} from "@/lib/domain";
import { investments, investors, operatingCosts, productWeights, products, trucks } from "@/lib/demo/catalog";
import { createRng, intBetween } from "@/lib/demo/rng";

const TRANSFERS: Array<{ date: string; productId: string; from: string; to: string; quantity: number }> = [
  { date: "2026-06-15", productId: "prod-falafel", from: "A", to: "B", quantity: 6 },
  { date: "2026-08-20", productId: "prod-bowl", from: "D", to: "C", quantity: 4 },
  { date: "2026-09-05", productId: "prod-shawarma", from: "B", to: "A", quantity: 5 },
];

function truckByCode(code: string) {
  const truck = trucks.find((item) => item.code === code);
  if (!truck) throw new Error(`Unknown truck ${code}`);
  return truck;
}

function demandMultiplier(code: string, date: string): number {
  if (code === "D" && date >= "2026-10-24") return 0;
  if (code === "C" && date >= "2026-08-01" && date <= "2026-08-31") return 0.34;
  return 1;
}

export function generateWorld(): World {
  const rng = createRng(365);
  const sales: SaleFact[] = [];
  const cogs: CogsFact[] = [];
  const soldByDay = new Map<string, number>();

  for (const date of eachDate(DEMO_START, DEMO_END)) {
    for (const truck of trucks) {
      const multiplier = demandMultiplier(truck.code, date);
      if (multiplier === 0) continue;
      const weekend = isWeekend(date) ? 1.28 : 1;
      const noise = 0.86 + rng() * 0.28;
      const meals = Math.max(8, Math.round(truck.baseMeals * weekend * noise * multiplier));
      const weights = productWeights.map((weight) => weight * (0.75 + rng() * 0.5));
      const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
      let assigned = 0;
      products.forEach((product, index) => {
        const isLast = index === products.length - 1;
        const quantity = isLast ? Math.max(0, meals - assigned) : Math.max(0, Math.round((meals * weights[index]) / weightTotal));
        assigned += quantity;
        if (quantity <= 0) return;
        const gross = product.unitPrice * BigInt(quantity);
        let discount = ZERO;
        if (rng() < 0.08) discount = applyBps(gross, rng() < 0.5 ? 500 : 1000);
        let refund = ZERO;
        if (rng() < 0.012 && quantity > 1) refund = product.unitPrice;
        if (discount + refund > gross) refund = ZERO;
        const eligible = gross - discount - refund;
        const charity = applyBps(eligible, CHARITY_BPS);
        const taxCollected = applyBps(eligible, GST_BPS);
        const reference = `SAL-${date.replaceAll("-", "")}-${truck.code}-${product.id.replace("prod-", "").slice(0, 4).toUpperCase()}`;
        sales.push({
          id: `sale-${sales.length + 1}`,
          truckId: truck.id,
          date,
          productId: product.id,
          quantity,
          unitPrice: product.unitPrice,
          gross,
          discount,
          refund,
          taxCollected,
          eligible,
          charity,
          reference,
        });
        cogs.push({
          truckId: truck.id,
          date,
          productId: product.id,
          quantity,
          unitCost: product.unitCost,
          amount: product.unitCost * BigInt(quantity),
        });
        soldByDay.set(`${truck.id}|${product.id}|${date}`, quantity);
      });
    }
  }

  const movements: InventoryMovement[] = [];
  const closing = new Map<string, number>();
  let movementNo = 1;
  for (const product of products) {
    for (const truck of trucks) {
      closing.set(`${truck.id}|${product.id}`, 24 + productWeights[products.indexOf(product)] % 9);
    }
  }

  for (const date of eachDate(DEMO_START, DEMO_END)) {
    for (const product of products) {
      for (const truck of trucks) {
        const key = `${truck.id}|${product.id}`;
        const opening = closing.get(key) ?? 0;
        const sold = soldByDay.get(`${truck.id}|${product.id}|${date}`) ?? 0;
        const transferOut = TRANSFERS.find(
          (transfer) => transfer.date === date && transfer.productId === product.id && truckByCode(transfer.from).id === truck.id,
        );
        const transferIn = TRANSFERS.find(
          (transfer) => transfer.date === date && transfer.productId === product.id && truckByCode(transfer.to).id === truck.id,
        );
        const transferredOut = transferOut?.quantity ?? 0;
        const transferredIn = transferIn?.quantity ?? 0;
        const paused = truck.code === "D" && date >= "2026-10-24";
        const donated = paused ? 0 : sold > 0 ? intBetween(rng, 0, date.endsWith("-5") || date.endsWith("-2") ? 3 : 1) : 0;
        const wasted = paused ? (product.id === "prod-shawarma" ? 1 : 0) : rng() < 0.18 ? 1 : 0;
        const returned = !paused && rng() < 0.05 ? 1 : 0;
        const desired = 28;
        const received = Math.max(
          0,
          desired - opening + sold + donated + wasted + returned + transferredOut - transferredIn,
        );
        const next =
          opening + received + transferredIn - sold - donated - wasted - returned - transferredOut;
        if (next < 0) {
          throw new Error(`Negative stock for ${truck.code} ${product.name} on ${date}`);
        }
        closing.set(key, next);
        const push = (type: InventoryMovement["type"], quantity: number, note: string) => {
          if (quantity <= 0 && type !== "opening") return;
          if (type === "opening" && date !== DEMO_START) return;
          movements.push({
            id: `mov-${movementNo++}`,
            truckId: truck.id,
            productId: product.id,
            date,
            type,
            quantity: type === "opening" ? opening : quantity,
            reference: `${type.slice(0, 3).toUpperCase()}-${date.replaceAll("-", "")}-${truck.code}`,
            note,
          });
        };
        push("opening", opening, "Opening stock brought forward.");
        push("received", received, "Dispatched from the central kitchen.");
        push("sold", sold, "Meals sold.");
        push("donated", donated, "Meals issued to the charity distribution cycle.");
        push("wasted", wasted, "Spoilage written off.");
        push("returned", returned, "Returned to the central kitchen.");
        push("transferred_out", transferredOut, "Transferred to another Foodoo365 truck.");
        push("transferred_in", transferredIn, "Received from another Foodoo365 truck.");
      }
    }
  }

  const expenses: ExpenseFact[] = [];
  let expenseNo = 1;
  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  for (const month of months) {
    const postedOn = month === "2026-10" ? "2026-10-03" : `${month}-03`;
    const periodEnd = month === "2026-10" ? DEMO_END : monthEnd(`${month}-01`);
    for (const truck of trucks) {
      const cost = operatingCosts[truck.code];
      const lines: Array<[string, string, number]> = [
        ["Wages", "Crew wages and supervisor cover", cost.wages],
        ["Fuel", "Generator and vehicle fuel", cost.fuel],
        ["Packaging", "Packaging and service disposables", cost.packaging],
        ["Permits", "Pitch permits and municipal fees", cost.permits],
        ["Kitchen allocation", "Central kitchen production allocation", cost.kitchen],
        ["Maintenance", "Routine servicing", cost.maintenance],
      ];
      for (const [category, description, amount] of lines) {
        expenses.push({
          id: `exp-${expenseNo++}`,
          truckId: truck.id,
          date: postedOn,
          category,
          classification: "operating",
          description,
          amount: aed(amount),
          reference: `EXP-${month.replace("-", "")}-${truck.code}-${category.slice(0, 3).toUpperCase()}`,
        });
      }
      if (truck.code === "B" && month === "2026-06") {
        const fuel = expenses.find((expense) => expense.reference === "EXP-202606-B-FUE");
        if (fuel) {
          expenses.push({ ...fuel, id: `exp-${expenseNo++}` });
        }
      }
      if (truck.code === "A" && month === "2026-05") {
        expenses.push({
          id: `exp-${expenseNo++}`,
          truckId: truck.id,
          date: postedOn,
          category: "charity_allocation",
          classification: "operating",
          description: "Rejected charity posting. Charity is deducted from eligible sales and cannot be expensed again.",
          amount: aed(500),
          reference: "EXP-202605-A-CHARITY-REJECTED",
        });
      }
      if (truck.code === "C" && month === "2026-08") {
        expenses.push({
          id: `exp-${expenseNo++}`,
          truckId: truck.id,
          date: "2026-08-12",
          category: "Repairs",
          classification: "operating",
          description: "Refrigeration compressor replacement",
          amount: aed(22000),
          reference: "EXP-202608-C-REP",
        });
      }
      const monthSales = sales.filter((sale) => sale.truckId === truck.id && sale.date >= `${month}-01` && sale.date <= periodEnd);
      const eligible = sumFils(monthSales.map((sale) => sale.eligible));
      expenses.push({
        id: `exp-${expenseNo++}`,
        truckId: truck.id,
        date: periodEnd,
        category: "Card processing",
        classification: "other_cost",
        description: "Card processing fees at 1.50% of eligible sales",
        amount: applyBps(eligible, CARD_FEE_BPS),
        reference: `FEE-${month.replace("-", "")}-${truck.code}`,
      });
      let spoilage: Fils = 0n;
      for (const movement of movements) {
        if (movement.truckId !== truck.id || movement.type !== "wasted" || !movement.date.startsWith(month)) continue;
        const product = products.find((item) => item.id === movement.productId);
        if (!product) continue;
        spoilage += product.unitCost * BigInt(movement.quantity);
      }
      if (spoilage > 0n) {
        expenses.push({
          id: `exp-${expenseNo++}`,
          truckId: truck.id,
          date: periodEnd,
          category: "Spoilage",
          classification: "operating",
          description: "Spoilage at food cost for meals wasted in the month",
          amount: spoilage,
          reference: `WST-${month.replace("-", "")}-${truck.code}`,
        });
      }
    }
  }

  const adjustments: PeriodAdjustment[] = [
    {
      id: "adj-2026-07-b",
      truckId: truckByCode("B").id,
      periodId: `${truckByCode("B").id}:2026-07`,
      date: "2026-08-09",
      reason: "Municipality permit invoice for July was received after that period was finalized.",
      distributableDelta: -aed(1450),
      reference: "ADJ-2026-07-B-001",
    },
  ];

  const periods: AccountingPeriod[] = [];
  for (const month of months) {
    for (const truck of trucks) {
      const open = month === "2026-10";
      periods.push({
        id: `${truck.id}:${month}`,
        truckId: truck.id,
        label: open ? "October 2026 (open)" : `${monthStart(`${month}-01`).slice(0, 7)}`,
        start: `${month}-01`,
        end: open ? DEMO_END : monthEnd(`${month}-01`),
        status: open ? "open" : "finalized",
        finalizedOn: open ? null : `${addDays(monthEnd(`${month}-01`), 8)}`,
      });
    }
  }

  const entitlementTotals: Record<string, number> = {};
  for (const truck of trucks) {
    entitlementTotals[truck.id] = investments
      .filter((investment) => investment.truckId === truck.id && investment.status === "active")
      .reduce((total, investment) => total + investment.entitlementBps, 0);
  }

  const { profits, snapshots, earnings } = deriveFinancials({
    trucks,
    investments,
    sales,
    expenses,
    cogs,
    adjustments,
    periods,
    entitlementTotals,
  });

  const payouts: Payout[] = [];
  let payoutNo = 1;
  for (const earning of earnings) {
    if (earning.approvedEarnings <= 0n) continue;
    const truck = trucks.find((item) => item.id === earning.truckId);
    const month = earning.periodStart.slice(0, 7);
    if (month === "2026-09") {
      const paid = applyBps(earning.approvedEarnings, 5500);
      const remaining = earning.approvedEarnings - paid;
      payouts.push({
        id: `pay-${payoutNo++}`,
        investorId: earning.investorId,
        investmentId: earning.investmentId,
        truckId: earning.truckId,
        periodId: earning.periodId,
        amount: paid,
        date: "2026-10-12",
        status: "paid",
        reference: `PAY-202609-${truck?.code}-A`,
        note: "Partial payout of approved September earnings.",
      });
      if (remaining > 0n) {
        payouts.push({
          id: `pay-${payoutNo++}`,
          investorId: earning.investorId,
          investmentId: earning.investmentId,
          truckId: earning.truckId,
          periodId: earning.periodId,
          amount: remaining,
          date: "2026-10-31",
          status: "approved",
          reference: `PAY-202609-${truck?.code}-B`,
          note: "Approved remainder scheduled for 31 October 2026.",
        });
      }
      continue;
    }
    const paidOn = earning.periodId.endsWith("2026-05")
      ? "2026-06-12"
      : earning.periodId.endsWith("2026-06")
        ? "2026-07-12"
        : earning.periodId.endsWith("2026-07")
          ? "2026-08-12"
          : "2026-09-12";
    payouts.push({
      id: `pay-${payoutNo++}`,
      investorId: earning.investorId,
      investmentId: earning.investmentId,
      truckId: earning.truckId,
      periodId: earning.periodId,
      amount: earning.approvedEarnings,
      date: paidOn,
      status: "paid",
      reference: `PAY-${month.replace("-", "")}-${truck?.code}`,
      note: `Payout of approved ${month} earnings.`,
    });
  }

  const charityUses: CharityUse[] = [];
  let charityNo = 1;
  for (const truck of trucks) {
    let cursor = DEMO_START;
    while (cursor <= DEMO_END) {
      const weekEnd = addDays(cursor, 6) > DEMO_END ? DEMO_END : addDays(cursor, 6);
      let meals = 0;
      let amount = ZERO;
      for (const movement of movements) {
        if (movement.truckId !== truck.id || movement.type !== "donated") continue;
        if (movement.date < cursor || movement.date > weekEnd) continue;
        const product = products.find((item) => item.id === movement.productId);
        if (!product) continue;
        meals += movement.quantity;
        amount += product.unitCost * BigInt(movement.quantity);
      }
      if (meals > 0) {
        charityUses.push({
          id: `chu-${charityNo++}`,
          truckId: truck.id,
          date: weekEnd,
          status: "distributed",
          meals,
          amount,
          reference: `CHU-${weekEnd.replaceAll("-", "")}-${truck.code}`,
          note: "Meals distributed through the community meal cycle. Beneficiary identities are not stored in the investor portal.",
        });
      }
      cursor = addDays(weekEnd, 1);
    }
  }

  const sponsored: Array<[string, string, number, string]> = [
    ["A", "2026-06-12", 40, "Meal sponsorship committed for a community service day. Not yet a count of people served."],
    ["B", "2026-07-18", 30, "Sponsorship reserved for prepared meals. Distribution is tracked separately."],
    ["C", "2026-09-09", 24, "Sponsorship committed after the truck returned to full service."],
    ["D", "2026-05-22", 36, "Sponsorship committed at Al Majaz. Distribution status is separate."],
  ];
  for (const [code, date, meals, note] of sponsored) {
    const truck = truckByCode(code);
    charityUses.push({
      id: `chu-${charityNo++}`,
      truckId: truck.id,
      date,
      status: "sponsored",
      meals,
      amount: aed(9) * BigInt(meals),
      reference: `CHS-${date.replaceAll("-", "")}-${code}`,
      note,
    });
  }
  const prepared: Array<[string, string, number]> = [
    ["A", "2026-10-20", 18],
    ["C", "2026-10-15", 12],
  ];
  for (const [code, date, meals] of prepared) {
    const truck = truckByCode(code);
    charityUses.push({
      id: `chu-${charityNo++}`,
      truckId: truck.id,
      date,
      status: "prepared",
      meals,
      amount: aed(9) * BigInt(meals),
      reference: `CHP-${date.replaceAll("-", "")}-${code}`,
      note: "Meals prepared and awaiting distribution. They are not reported as people fed.",
    });
  }

  const notifications: PortalNotification[] = investors.flatMap((investor) => {
    const mine = investments.filter((investment) => investment.investorId === investor.id);
    const truckNames = mine
      .map((investment) => trucks.find((truck) => truck.id === investment.truckId)?.name)
      .filter(Boolean)
      .join(" and ");
    return [
      {
        id: `ntf-${investor.id}-sep`,
        investorId: investor.id,
        title: "September earnings approved",
        body: `A portion of your September profit has been paid. The approved remainder is scheduled for 31 October.`,
        category: "payout" as const,
        createdOn: "2026-10-12",
        href: "/profit",
        unread: true,
      },
      {
        id: `ntf-${investor.id}-stmt`,
        investorId: investor.id,
        title: "August statement finalized",
        body: `The August accounting period for ${truckNames} is finalized. Open Profit & Earnings for the calculation breakdown.`,
        category: "statement" as const,
        createdOn: "2026-09-08",
        href: "/reports",
        unread: false,
      },
      {
        id: `ntf-${investor.id}-charity`,
        investorId: investor.id,
        title: "Charity meals distributed",
        body: "Distributed meals are counted only when they leave the distribution cycle. Allocated funds are not treated as people fed.",
        category: "charity" as const,
        createdOn: "2026-10-18",
        href: "/charity",
        unread: true,
      },
      {
        id: `ntf-${investor.id}-maint`,
        investorId: investor.id,
        title: investor.id === investors[2].id ? "Majaz Meals is in maintenance" : "Your trucks are in service",
        body:
          investor.id === investors[2].id
            ? "Majaz Meals paused sales on 24 October for scheduled equipment service."
            : "No service pause is currently recorded on the trucks in your portfolio.",
        category: "operations" as const,
        createdOn: "2026-10-24",
        href: "/trucks",
        unread: investor.id === investors[2].id,
      },
    ];
  });

  notifications.push({
    id: "ntf-james-loss",
    investorId: investors[1].id,
    title: "August loss will carry forward",
    body: "Corniche Plates recorded a loss in August. Your agreement carries that loss against later distributable profit. It does not create a payout.",
    category: "statement",
    createdOn: "2026-09-08",
    href: "/profit",
    unread: true,
  });
  notifications.push({
    id: "ntf-amina-adj",
    investorId: investors[0].id,
    title: "July adjustment posted",
    body: "A permit invoice for Beachside Kitchen was recorded as a controlled adjustment. The finalized July snapshot was not overwritten.",
    category: "statement",
    createdOn: "2026-08-09",
    href: "/profit",
    unread: false,
  });
  notifications.push({
    id: "ntf-james-adj",
    investorId: investors[1].id,
    title: "July adjustment posted",
    body: "A permit invoice for Beachside Kitchen was recorded as a controlled adjustment. The finalized July snapshot was not overwritten.",
    category: "statement",
    createdOn: "2026-08-09",
    href: "/profit",
    unread: false,
  });

  return {
    investors,
    trucks,
    products,
    investments,
    sales,
    expenses,
    cogs,
    movements,
    adjustments,
    periods,
    snapshots,
    profits,
    earnings,
    payouts,
    charityUses,
    notifications,
    entitlementTotals,
  };
}
