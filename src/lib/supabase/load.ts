import type { Fils } from "@/lib/money";
import { deriveFinancials } from "@/lib/finance/derive";
import type { World } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function fils(value: unknown): Fils {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  throw new Error("Expected an integer paise amount from Supabase.");
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadSupabaseWorld(): Promise<World> {
  const supabase = await createSupabaseServerClient();
  const [
    investorRows,
    truckRows,
    productRows,
    investmentRows,
    saleRows,
    expenseRows,
    cogsRows,
    movementRows,
    periodRows,
    adjustmentRows,
    snapshotRows,
    payoutRows,
    charityRows,
    notificationRows,
    totals,
  ] = await Promise.all([
    rows(supabase.from("profiles").select("*")),
    rows(supabase.from("trucks").select("*")),
    rows(supabase.from("products").select("*")),
    rows(supabase.from("investments").select("*")),
    rows(supabase.from("sales").select("*")),
    rows(supabase.from("expenses").select("*")),
    rows(supabase.from("cogs").select("*")),
    rows(supabase.from("inventory_movements").select("*")),
    rows(supabase.from("accounting_periods").select("*")),
    rows(supabase.from("period_adjustments").select("*")),
    rows(supabase.from("profit_snapshots").select("*")),
    rows(supabase.from("payouts").select("*")),
    rows(supabase.from("charity_utilization").select("*")),
    rows(supabase.from("notifications").select("*")),
    supabase.rpc("truck_entitlement_totals"),
  ]);

  if (totals.error) throw new Error(totals.error.message);
  const entitlementTotals: Record<string, number> = {};
  for (const row of (totals.data ?? []) as Array<{ truck_id: string; entitlement_bps: number }>) {
    entitlementTotals[row.truck_id] = row.entitlement_bps;
  }

  const worldBase = {
    investors: investorRows.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      preferredName: String(row.preferred_name),
      email: String(row.email),
      phone: String(row.phone),
      city: String(row.city),
      joinedOn: String(row.joined_on),
      pan: String(row.pan ?? ""),
    })),
    trucks: truckRows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      location: String(row.location),
      district: String(row.district ?? ""),
      latitude: Number(row.latitude ?? 0),
      longitude: Number(row.longitude ?? 0),
      fssai: String(row.fssai ?? ""),
      gstin: String(row.gstin ?? ""),
      status: row.status as World["trucks"][number]["status"],
      statusNote: String(row.status_note),
      reserveBps: Number(row.reserve_bps),
      baseMeals: Number(row.base_meals),
    })),
    products: productRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      category: String(row.category),
      unitPrice: fils(row.unit_price_fils),
      unitCost: fils(row.unit_cost_fils),
    })),
    investments: investmentRows.map((row) => ({
      id: String(row.id),
      investorId: String(row.investor_id),
      truckId: String(row.truck_id),
      investedOn: String(row.invested_on),
      amount: fils(row.amount_fils),
      ownershipBps: row.ownership_bps === null ? null : Number(row.ownership_bps),
      entitlementBps: Number(row.entitlement_bps),
      status: row.status as World["investments"][number]["status"],
      agreementRef: String(row.agreement_ref),
      lossCarryforward: Boolean(row.loss_carryforward),
      notes: String(row.notes),
    })),
    sales: saleRows.map((row) => ({
      id: String(row.id),
      truckId: String(row.truck_id),
      date: String(row.sale_date),
      productId: String(row.product_id),
      quantity: Number(row.quantity),
      unitPrice: fils(row.unit_price_fils),
      gross: fils(row.gross_fils),
      discount: fils(row.discount_fils),
      refund: fils(row.refund_fils),
      taxCollected: fils(row.tax_fils),
      eligible: fils(row.eligible_fils),
      charity: fils(row.charity_fils),
      reference: String(row.reference),
    })),
    expenses: expenseRows.map((row) => ({
      id: String(row.id),
      truckId: String(row.truck_id),
      date: String(row.expense_date),
      category: String(row.category),
      classification: row.classification as "operating" | "other_cost",
      description: String(row.description),
      amount: fils(row.amount_fils),
      reference: String(row.reference),
    })),
    cogs: cogsRows.map((row) => ({
      truckId: String(row.truck_id),
      date: String(row.cogs_date),
      productId: String(row.product_id),
      quantity: Number(row.quantity),
      unitCost: fils(row.unit_cost_fils),
      amount: fils(row.amount_fils),
    })),
    movements: movementRows.map((row) => ({
      id: String(row.id),
      truckId: String(row.truck_id),
      productId: String(row.product_id),
      date: String(row.movement_date),
      type: row.movement_type as World["movements"][number]["type"],
      quantity: Number(row.quantity),
      reference: String(row.reference),
      note: String(row.note),
    })),
    adjustments: adjustmentRows.map((row) => ({
      id: String(row.id),
      truckId: String(row.truck_id),
      periodId: String(row.period_id),
      date: String(row.adjustment_date),
      reason: String(row.reason),
      distributableDelta: fils(row.distributable_delta_fils),
      reference: String(row.reference),
    })),
    periods: periodRows.map((row) => ({
      id: String(row.id),
      truckId: String(row.truck_id),
      label: String(row.label),
      start: String(row.period_start),
      end: String(row.period_end),
      status: row.status as "open" | "finalized",
      finalizedOn: row.finalized_on ? String(row.finalized_on) : null,
    })),
    payouts: payoutRows.map((row) => ({
      id: String(row.id),
      investorId: String(row.investor_id),
      investmentId: String(row.investment_id),
      truckId: String(row.truck_id),
      periodId: String(row.period_id),
      amount: fils(row.amount_fils),
      date: String(row.payout_date),
      status: row.status as "paid" | "approved",
      reference: String(row.reference),
      note: String(row.note),
    })),
    charityUses: charityRows.map((row) => ({
      id: String(row.id),
      truckId: String(row.truck_id),
      date: String(row.use_date),
      status: row.status as World["charityUses"][number]["status"],
      meals: Number(row.meals),
      amount: fils(row.amount_fils),
      reference: String(row.reference),
      note: String(row.note),
    })),
    notifications: notificationRows.map((row) => ({
      id: String(row.id),
      investorId: String(row.investor_id),
      title: String(row.title),
      body: String(row.body),
      category: row.category as World["notifications"][number]["category"],
      createdOn: String(row.created_on),
      href: String(row.href),
      unread: Boolean(row.unread),
    })),
    entitlementTotals,
  };

  const derived = deriveFinancials({
    trucks: worldBase.trucks,
    investments: worldBase.investments,
    sales: worldBase.sales,
    expenses: worldBase.expenses,
    cogs: worldBase.cogs,
    adjustments: worldBase.adjustments,
    periods: worldBase.periods,
    entitlementTotals,
  });

  const snapshots = snapshotRows.length
    ? snapshotRows.map((row) => ({
        periodId: String(row.period_id),
        truckId: String(row.truck_id),
        distributableBeforeAdjustments: fils(row.before_adjustment_fils),
        distributableProfit: fils(row.distributable_fils),
        storedOn: String(row.stored_on),
        note: String(row.note),
      }))
    : derived.snapshots;

  return {
    ...worldBase,
    profits: derived.profits,
    earnings: derived.earnings,
    snapshots,
  };
}
