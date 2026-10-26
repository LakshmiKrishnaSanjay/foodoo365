import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getScope } from "@/lib/data/queries";
import { scannedMeals, ticketsForTrucks } from "@/lib/demo/live-sales";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to see sales." }, { status: 401 });

  let truckIds: string[] | "all" = "all";
  if (session.role === "investor") {
    const scope = await getScope(session.id);
    truckIds = scope ? [...scope.truckIds] : [];
  } else if (session.role === "seller") {
    truckIds = session.truckId ? [session.truckId] : [];
  }

  const tickets = ticketsForTrucks(truckIds);
  return NextResponse.json({
    meals: scannedMeals(truckIds),
    sales: tickets.length,
    tickets: tickets.slice(0, 40),
  });
}
