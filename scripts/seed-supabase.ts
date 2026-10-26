/**
 * Loads the Kerala demonstration into Supabase.
 *
 * The portal runs without a database. Use this only when DATA_SOURCE=supabase.
 * Profiles reference auth.users, so this uses the service role rather than a static seed.sql.
 *
 * Local, after `npx supabase start` and `npx supabase db reset`:
 *   $env:SUPABASE_URL = "http://127.0.0.1:54321"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role from `npx supabase status`>"
 *   npm run seed:supabase
 *
 * Production, after `npx supabase db push`:
 *   $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<production service role>"
 *   npm run seed:supabase
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, investments, investors, products, trucks } from "../src/lib/demo/catalog";
import { generateWorld } from "../src/lib/demo/generate";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const world = generateWorld();
const n = (value: bigint) => Number(value);

async function chunked(table: string, rows: Record<string, unknown>[]) {
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(index, index + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  for (const investor of investors) {
    const created = await supabase.auth.admin.createUser({
      id: investor.id,
      email: investor.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (created.error && !/already|exists|registered/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }
  }

  const truckIds = trucks.map((truck) => truck.id);
  for (const table of ["notifications", "payouts", "charity_utilization", "profit_snapshots", "period_adjustments", "accounting_periods", "inventory_movements", "cogs", "expenses", "sales", "investments"]) {
    const column = table === "notifications" || table === "payouts" ? "investor_id" : "truck_id";
    const values = column === "investor_id" ? investors.map((investor) => investor.id) : truckIds;
    const { error } = await supabase.from(table).delete().in(column, values);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    investors.map((investor) => ({
      id: investor.id,
      full_name: investor.fullName,
      preferred_name: investor.preferredName,
      email: investor.email,
      phone: investor.phone,
      city: investor.city,
      pan: investor.pan,
      joined_on: investor.joinedOn,
    })),
  );
  if (profileError) throw new Error(profileError.message);

  const { error: truckError } = await supabase.from("trucks").upsert(
    trucks.map((truck) => ({
      id: truck.id,
      code: truck.code,
      name: truck.name,
      location: truck.location,
      district: truck.district,
      latitude: truck.latitude,
      longitude: truck.longitude,
      fssai: truck.fssai,
      gstin: truck.gstin,
      status: truck.status,
      status_note: truck.statusNote,
      reserve_bps: truck.reserveBps,
      base_meals: truck.baseMeals,
    })),
  );
  if (truckError) throw new Error(truckError.message);

  const { error: productError } = await supabase.from("products").upsert(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      unit_price_fils: n(product.unitPrice),
      unit_cost_fils: n(product.unitCost),
    })),
  );
  if (productError) throw new Error(productError.message);

  await chunked(
    "investments",
    investments.map((investment) => ({
      id: investment.id,
      investor_id: investment.investorId,
      truck_id: investment.truckId,
      invested_on: investment.investedOn,
      amount_fils: n(investment.amount),
      ownership_bps: investment.ownershipBps,
      entitlement_bps: investment.entitlementBps,
      status: investment.status,
      agreement_ref: investment.agreementRef,
      loss_carryforward: investment.lossCarryforward,
      notes: investment.notes,
    })),
  );
  await chunked(
    "sales",
    world.sales.map((sale) => ({
      id: sale.id,
      truck_id: sale.truckId,
      sale_date: sale.date,
      product_id: sale.productId,
      quantity: sale.quantity,
      unit_price_fils: n(sale.unitPrice),
      gross_fils: n(sale.gross),
      discount_fils: n(sale.discount),
      refund_fils: n(sale.refund),
      tax_fils: n(sale.taxCollected),
      eligible_fils: n(sale.eligible),
      charity_fils: n(sale.charity),
      reference: sale.reference,
    })),
  );
  await chunked(
    "expenses",
    world.expenses.map((expense) => ({
      id: expense.id,
      truck_id: expense.truckId,
      expense_date: expense.date,
      category: expense.category,
      classification: expense.classification,
      description: expense.description,
      amount_fils: n(expense.amount),
      reference: expense.reference,
    })),
  );
  await chunked(
    "cogs",
    world.cogs.map((row) => ({
      truck_id: row.truckId,
      cogs_date: row.date,
      product_id: row.productId,
      quantity: row.quantity,
      unit_cost_fils: n(row.unitCost),
      amount_fils: n(row.amount),
    })),
  );
  await chunked(
    "inventory_movements",
    world.movements.map((movement) => ({
      id: movement.id,
      truck_id: movement.truckId,
      product_id: movement.productId,
      movement_date: movement.date,
      movement_type: movement.type,
      quantity: movement.quantity,
      reference: movement.reference,
      note: movement.note,
    })),
  );
  await chunked(
    "accounting_periods",
    world.periods.map((period) => ({
      id: period.id,
      truck_id: period.truckId,
      label: period.label,
      period_start: period.start,
      period_end: period.end,
      status: period.status,
      finalized_on: period.finalizedOn,
    })),
  );
  await chunked(
    "period_adjustments",
    world.adjustments.map((adjustment) => ({
      id: adjustment.id,
      truck_id: adjustment.truckId,
      period_id: adjustment.periodId,
      adjustment_date: adjustment.date,
      reason: adjustment.reason,
      distributable_delta_fils: n(adjustment.distributableDelta),
      reference: adjustment.reference,
    })),
  );
  await chunked(
    "profit_snapshots",
    world.snapshots.map((snapshot) => ({
      period_id: snapshot.periodId,
      truck_id: snapshot.truckId,
      before_adjustment_fils: n(snapshot.distributableBeforeAdjustments),
      distributable_fils: n(snapshot.distributableProfit),
      stored_on: snapshot.storedOn,
      note: snapshot.note,
    })),
  );
  await chunked(
    "payouts",
    world.payouts.map((payout) => ({
      id: payout.id,
      investor_id: payout.investorId,
      investment_id: payout.investmentId,
      truck_id: payout.truckId,
      period_id: payout.periodId,
      amount_fils: n(payout.amount),
      payout_date: payout.date,
      status: payout.status,
      reference: payout.reference,
      note: payout.note,
    })),
  );
  await chunked(
    "charity_utilization",
    world.charityUses.map((use) => ({
      id: use.id,
      truck_id: use.truckId,
      use_date: use.date,
      status: use.status,
      meals: use.meals,
      amount_fils: n(use.amount),
      reference: use.reference,
      note: use.note,
    })),
  );
  await chunked(
    "notifications",
    world.notifications.map((item) => ({
      id: item.id,
      investor_id: item.investorId,
      title: item.title,
      body: item.body,
      category: item.category,
      created_on: item.createdOn,
      href: item.href,
      unread: item.unread,
    })),
  );
  console.log(`Seeded ${world.sales.length} sales for ${investors.map((investor) => investor.fullName).join(", ")}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
