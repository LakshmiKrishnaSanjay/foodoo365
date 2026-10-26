"use server";

import { revalidatePath } from "next/cache";
import { trucks } from "@/lib/demo/catalog";
import { parseMealCode, recordScannedSale, type SaleTicket } from "@/lib/demo/live-sales";
import { getSession } from "@/lib/auth/session";

export async function recordSaleAction(input: { code: string; quantity: number }): Promise<{ ticket: SaleTicket } | { error: string }> {
  const session = await getSession();
  if (!session || session.role !== "seller" || !session.truckId) return { error: "Only the person selling from a truck can record this." };
  const parsed = parseMealCode(input.code);
  if (!parsed) return { error: "That is not a meal QR code. It should look like FD1|A|prod-shawarma." };
  const truck = trucks.find((item) => item.id === session.truckId);
  if (!truck || truck.code !== parsed.truckCode) return { error: `This QR is for truck ${parsed.truckCode}. You sell from truck ${truck?.code ?? ""}.` };

  const result = recordScannedSale({
    truckCode: parsed.truckCode,
    productId: parsed.productId,
    sellerName: session.fullName,
    quantity: input.quantity,
  });
  if ("error" in result) return result;

  revalidatePath("/overview");
  revalidatePath("/sales");
  revalidatePath("/profit");
  revalidatePath("/charity");
  revalidatePath("/admin");
  revalidatePath("/sell");
  return { ticket: result.ticket };
}
