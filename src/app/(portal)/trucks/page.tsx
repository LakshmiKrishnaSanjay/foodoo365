import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageIntro, PageSkeleton, StatusPill, TruckMark } from "@/components/portal/bits";
import { FilterBar } from "@/components/portal/filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTrucks, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "My Food Trucks" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><TrucksPage searchParams={props.searchParams} /></Suspense>;
}

async function TrucksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters, choices } = await readRequest(searchParams);
  const trucks = await getTrucks(session.id, filters);
  if (!trucks) return null;
  const query = preservedQuery(filters);
  return (
    <div className="space-y-6">
      <PageIntro title="My food trucks" description="Operational results for the trucks assigned to you. Other investors' capital, agreements and payouts are not shown." actions={
        <div className="flex gap-2">
          <Button asChild variant={filters.view === "grid" ? "default" : "outline"} className="h-10"><Link href={`/trucks${preservedQuery(filters, { view: "grid" })}`}>Grid</Link></Button>
          <Button asChild variant={filters.view === "table" ? "default" : "outline"} className="h-10"><Link href={`/trucks${preservedQuery(filters, { view: "table" })}`}>Table</Link></Button>
        </div>
      } />
      <Suspense><FilterBar trucks={choices.trucks} truck={filters.truck} /></Suspense>
      {trucks.length === 0 ? <EmptyState title="No trucks match" body="Choose another truck or widen the date range." /> : filters.view === "table" ? (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Truck</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Meals</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Your earnings</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trucks.map((truck) => (
                <TableRow key={truck.id}>
                  <TableCell>{truck.name}<span className="block text-xs text-muted-foreground">{truck.location}</span></TableCell>
                  <TableCell><StatusPill status={truck.status} /></TableCell>
                  <TableCell className="tabular-nums">{truck.revenue.formatted}</TableCell>
                  <TableCell className="tabular-nums">{truck.sold.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="tabular-nums">{truck.profit.formatted}</TableCell>
                  <TableCell className="tabular-nums text-gold">{truck.earnings.formatted}</TableCell>
                  <TableCell><Button asChild size="sm" variant="outline"><Link href={`/trucks/${truck.id}${query}`}>Details</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {trucks.map((truck) => (
            <article key={truck.id} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex justify-between gap-3">
                <div className="flex gap-3">
                  <TruckMark code={truck.code} />
                  <div>
                    <h2 className="font-heading text-2xl">{truck.name}</h2>
                    <p className="text-sm text-muted-foreground">{truck.location}</p>
                  </div>
                </div>
                <StatusPill status={truck.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{truck.statusNote}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <Metric label="Dispatched" value={truck.dispatched.toLocaleString("en-IN")} />
                <Metric label="Sold" value={truck.sold.toLocaleString("en-IN")} />
                <Metric label="Charity meals" value={truck.donated.toLocaleString("en-IN")} />
                <Metric label="Returned" value={truck.returned.toLocaleString("en-IN")} />
                <Metric label="Wasted" value={truck.wasted.toLocaleString("en-IN")} />
                <Metric label="Closing stock" value={truck.stock.toLocaleString("en-IN")} />
                <Metric label="Revenue" value={truck.revenue.formatted} />
                <Metric label="Costs" value={truck.expenses.formatted} />
                <Metric label="Charity allocation" value={truck.charity.formatted} />
                <Metric label="Net profit" value={truck.profit.formatted} />
                <Metric label="Your entitlement" value={truck.entitlement} />
                <Metric label="Your earnings" value={truck.earnings.formatted} />
              </dl>
              <Button asChild className="mt-4 h-10"><Link href={`/trucks/${truck.id}${query}`}>View details</Link></Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>;
}
