import { Suspense } from "react";
import { redirect } from "next/navigation";
import { trucks } from "@/lib/demo/catalog";
import { getSession } from "@/lib/auth/session";
import { DeskFrame } from "@/components/desk/frame";
import { SellerDesk } from "@/components/desk/seller-desk";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Opening the truck…</div>}>
      <SellPage />
    </Suspense>
  );
}

async function SellPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "seller") redirect(session.role === "investor" ? "/overview" : "/admin");
  const truck = trucks.find((item) => item.id === session.truckId);
  if (!truck) redirect("/login");

  return (
    <DeskFrame name={session.fullName} role={`Seller · truck ${truck.code}`}>
      <SellerDesk truckName={truck.name} truckCode={truck.code} location={`${truck.location}, ${truck.district}`} statusNote={truck.statusNote} />
    </DeskFrame>
  );
}
