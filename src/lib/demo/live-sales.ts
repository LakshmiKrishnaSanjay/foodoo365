import { products, trucks } from "@/lib/demo/catalog";
import { getWorld } from "@/lib/demo/world";
import { CHARITY_BPS, DEMO_END, GST_BPS } from "@/lib/dates";
import { applyBps, formatInr, ZERO } from "@/lib/money";

export interface SaleTicket {
  saleNumber: string;
  truckId: string;
  truckCode: string;
  truckName: string;
  productId: string;
  productName: string;
  quantity: number;
  amount: string;
  sellerName: string;
  soldAt: string;
}

const liveStore = globalThis as typeof globalThis & { __foodooLive?: { tickets: SaleTicket[]; nextNumber: number } };

function live() {
  if (!liveStore.__foodooLive) liveStore.__foodooLive = { tickets: [], nextNumber: 1001 };
  return liveStore.__foodooLive;
}

export function mealCode(truckCode: string, productId: string): string {
  return `FD1|${truckCode}|${productId}`;
}

export function parseMealCode(raw: string): { truckCode: string; productId: string } | null {
  const parts = raw.trim().split("|");
  if (parts.length !== 3 || parts[0] !== "FD1" || !parts[1] || !parts[2]) return null;
  return { truckCode: parts[1], productId: parts[2] };
}

export function listTickets(): SaleTicket[] {
  return live().tickets.slice().reverse();
}

export function recordScannedSale(input: { truckCode: string; productId: string; sellerName: string; quantity: number }): { ticket: SaleTicket } | { error: string } {
  const truck = trucks.find((item) => item.code === input.truckCode);
  const product = products.find((item) => item.id === input.productId);
  const quantity = input.quantity;
  if (!truck || !product) return { error: "That QR code is not a Foodoo365 meal." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { error: "Sell between 1 and 20 of that meal." };
  const gross = product.unitPrice * BigInt(quantity);
  const eligible = gross;
  const charity = applyBps(eligible, CHARITY_BPS);
  const tax = applyBps(eligible, GST_BPS);
  const book = live();
  const saleNumber = `FD-${book.nextNumber}`;
  book.nextNumber += 1;

  const world = getWorld();
  world.sales.push({
    id: `scan-${saleNumber}`,
    truckId: truck.id,
    date: DEMO_END,
    productId: product.id,
    quantity,
    unitPrice: product.unitPrice,
    gross,
    discount: ZERO,
    refund: ZERO,
    taxCollected: tax,
    eligible,
    charity,
    reference: saleNumber,
  });
  world.cogs.push({
    truckId: truck.id,
    date: DEMO_END,
    productId: product.id,
    quantity,
    unitCost: product.unitCost,
    amount: product.unitCost * BigInt(quantity),
  });

  const ticket: SaleTicket = {
    saleNumber,
    truckId: truck.id,
    truckCode: truck.code,
    truckName: truck.name,
    productId: product.id,
    productName: product.name,
    quantity,
    amount: formatInr(eligible),
    sellerName: input.sellerName,
    soldAt: new Date().toISOString(),
  };
  live().tickets.push(ticket);
  return { ticket };
}

export function ticketsForTrucks(truckIds: string[] | "all"): SaleTicket[] {
  const rows = listTickets();
  if (truckIds === "all") return rows;
  const allowed = new Set(truckIds);
  return rows.filter((ticket) => allowed.has(ticket.truckId));
}

export function menuCards() {
  return trucks.map((truck) => ({
    code: truck.code,
    name: truck.name,
    location: truck.location,
    status: truck.status,
    meals: products.map((product) => ({
      id: product.id,
      name: product.name,
      price: formatInr(product.unitPrice),
      code: mealCode(truck.code, product.id),
    })),
  }));
}

export function scannedMeals(truckIds: string[] | "all"): number {
  return ticketsForTrucks(truckIds).reduce((total, ticket) => total + ticket.quantity, 0);
}
