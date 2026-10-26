import { Suspense } from "react";
import { redirect } from "next/navigation";
import { investments, investors, trucks } from "@/lib/demo/catalog";
import { getSession, readIds } from "@/lib/auth/session";
import { getBellFeed } from "@/lib/data/queries";
import { isSupabaseMode } from "@/lib/supabase/mode";
import { Shell } from "@/components/portal/shell";
import { PageSkeleton } from "@/components/portal/bits";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "seller") redirect("/sell");
  if (session.role === "admin" || session.role === "super-admin") redirect("/admin");
  const bell = await getBellFeed(session.id, await readIds());
  const demoInvestors = isSupabaseMode()
    ? []
    : investors.map((investor) => {
        const codes = investments
          .filter((investment) => investment.investorId === investor.id)
          .map((investment) => trucks.find((truck) => truck.id === investment.truckId)?.code)
          .filter((code): code is string => Boolean(code));
        return { id: investor.id, name: investor.fullName, detail: `Trucks ${codes.join(" and ")}` };
      });
  return (
    <Shell user={session} unread={bell.unread} notices={bell.notices} demoInvestors={demoInvestors}>
      {children}
    </Shell>
  );
}
