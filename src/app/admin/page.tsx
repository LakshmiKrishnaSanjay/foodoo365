import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DeskFrame } from "@/components/desk/frame";
import { SaleBoard } from "@/components/desk/sale-board";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Opening the sales board…</div>}>
      <AdminPage />
    </Suspense>
  );
}

async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "seller") redirect("/sell");
  if (session.role === "investor") redirect("/overview");

  const superAdmin = session.role === "super-admin";
  return (
    <DeskFrame name={session.fullName} role={superAdmin ? "Super admin" : "Admin"}>
      <SaleBoard
        title={superAdmin ? "Every sale number" : "Food sold today"}
        detail={
          superAdmin
            ? "You see every truck and every sale number. Each number is one scan from the person selling in that truck, with the meal count on that sale."
            : "You see every truck. Each row is a scanned sale: the sale number, how many meals, and which truck sold them. Investors only see the trucks they own."
        }
      />
    </DeskFrame>
  );
}
