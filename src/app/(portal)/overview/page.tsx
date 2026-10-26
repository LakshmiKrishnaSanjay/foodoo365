import Link from "next/link";
import { Suspense } from "react";
import { CompareBars, LineTrend, TrendChart } from "@/components/portal/charts";
import { EmptyState, PageIntro, PageSkeleton, Panel, StatusPill, TruckMark } from "@/components/portal/bits";
import { KpiGrid } from "@/components/portal/kpi-grid";
import { Button } from "@/components/ui/button";
import { getOverview, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Overview" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OverviewPage searchParams={props.searchParams} />
    </Suspense>
  );
}

async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters } = await readRequest(searchParams);
  const data = await getOverview(session.id, filters);
  if (!data) return null;
  const query = preservedQuery(filters);

  return (
    <div className="space-y-6">
      <PageIntro
        title={`Welcome back, ${session.preferredName}`}
        description="Twenty percent of eligible sales is set aside for charity. Profit is what remains after that allocation and the truck's costs, and your earnings are your share of that profit."
      />
      <KpiGrid items={data.kpis} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Monthly revenue trend" description={`Eligible sales from ${data.rangeLabel}. Tax collected for the authorities is excluded.`}>
          <TrendChart data={data.months} series={[{ key: "revenue", name: "Eligible revenue", color: "var(--primary)" }]} />
        </Panel>
        <Panel title="Profit performance" description="Distributable profit of your trucks, after charity, costs and reserves.">
          <LineTrend data={data.months} series={[{ key: "profit", name: "Truck profit", color: "var(--primary)" }, { key: "earnings", name: "Your earnings", color: "var(--gold)" }]} />
        </Panel>
        <Panel title="Revenue vs expenses" description="Expenses here are food cost, operating costs and other approved costs. Charity is shown separately.">
          <CompareBars data={data.months} xKey="label" bars={[{ key: "revenue", name: "Revenue", color: "var(--primary)" }, { key: "expenses", name: "Costs", color: "var(--gold)" }]} />
        </Panel>
        <Panel title="Charity contribution trend" description="Twenty percent of eligible sales, allocated in the charity ledger.">
          <TrendChart data={data.months} series={[{ key: "charity", name: "Charity allocated", color: "var(--positive)" }]} />
        </Panel>
      </div>
      <Panel title="Truck performance comparison" description="Full truck revenue and profit. Your personal earnings are on each card below.">
        <CompareBars data={data.truckComparison} bars={[{ key: "revenue", name: "Eligible revenue", color: "var(--primary)" }, { key: "profit", name: "Distributable profit", color: "var(--gold)" }]} />
      </Panel>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">My food trucks</h2>
        {data.trucks.length === 0 ? <EmptyState title="No trucks in this view" body="The selected filter does not match a truck assigned to your account." /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.trucks.map((truck) => (
              <article key={truck.id} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <TruckMark code={truck.code} />
                    <div>
                      <p className="text-xs text-muted-foreground">Truck {truck.code}</p>
                      <h3 className="font-heading text-xl">{truck.name}</h3>
                      <p className="text-sm text-muted-foreground">{truck.location}</p>
                    </div>
                  </div>
                  <StatusPill status={truck.status} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-muted-foreground">Eligible sales</dt><dd className="font-medium tabular-nums">{truck.sales.formatted}</dd></div>
                  <div><dt className="text-muted-foreground">Meals sold</dt><dd className="font-medium tabular-nums">{truck.meals.toLocaleString("en-AE")}</dd></div>
                  <div><dt className="text-muted-foreground">Truck profit</dt><dd className="font-medium tabular-nums">{truck.profit.formatted}</dd></div>
                  <div><dt className="text-muted-foreground">Your entitlement</dt><dd className="font-medium text-gold">{truck.entitlement}</dd></div>
                  <div><dt className="text-muted-foreground">Your earnings</dt><dd className="font-medium tabular-nums text-gold">{truck.earnings.formatted}</dd></div>
                  <div><dt className="text-muted-foreground">Attributed charity</dt><dd className="font-medium tabular-nums">{truck.charity.formatted}</dd></div>
                </dl>
                <Button asChild variant="outline" className="mt-4 h-10"><Link href={`/trucks/${truck.id}${query}`}>View details</Link></Button>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent transactions" action={<Button asChild variant="ghost"><Link href={`/transactions${query}`}>View all</Link></Button>}>
          {data.transactions.length === 0 ? <EmptyState title="No transactions" body="Nothing was recorded for these dates." /> : (
            <ul className="divide-y divide-border">
              {data.transactions.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{row.description}</p>
                    <p className="text-muted-foreground">{row.dateLabel} · {row.truck}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{row.amount.formatted}</p>
                    <p className="text-xs text-muted-foreground">{row.direction}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Latest profit distributions">
          {data.distributions.length === 0 ? <EmptyState title="No payouts in this range" body="Paid distributions appear here when their payment date falls in the selected dates." /> : (
            <ul className="divide-y divide-border">
              {data.distributions.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{row.truck}</p>
                    <p className="text-muted-foreground">{row.date} · {row.reference}</p>
                  </div>
                  <p className="tabular-nums text-positive">{row.amount.formatted}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent charity impact">
          {data.charity.length === 0 ? <EmptyState title="No charity activity" body="Sponsored, prepared and distributed meals are listed when they fall in this range." /> : (
            <ul className="divide-y divide-border">
              {data.charity.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{row.status} · {row.meals} meals</p>
                    <p className="text-muted-foreground">{row.date} · {row.truck}</p>
                  </div>
                  <p className="tabular-nums">{row.amount.formatted}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Upcoming approved payouts">
          {data.upcoming.length === 0 ? <EmptyState title="No payout is waiting" body="Approved amounts that have not been paid will appear here." /> : (
            <ul className="divide-y divide-border">
              {data.upcoming.map((row) => (
                <li key={row.id} className="py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{row.truck}</p>
                    <p className="tabular-nums text-gold">{row.amount.formatted}</p>
                  </div>
                  <p className="text-muted-foreground">{row.date} · {row.reference}</p>
                  <p className="mt-1 text-muted-foreground">{row.note}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
