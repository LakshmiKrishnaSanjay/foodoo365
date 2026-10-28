import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompareBars, CountBars } from "@/components/portal/charts";
import { PageIntro, PageSkeleton, Panel, StatusPill } from "@/components/portal/bits";
import { FilterBar } from "@/components/portal/filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTruckDetail, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Truck" };

export default function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><TruckPage params={props.params} searchParams={props.searchParams} /></Suspense>;
}

async function TruckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters, choices } = await readRequest(searchParams);
  const truck = await getTruckDetail(session.id, (await params).id, filters);
  if (!truck) notFound();
  return (
    <div className="space-y-6">
      <PageIntro title={`Truck ${truck.code} · ${truck.name}`} description={`${truck.location}. ${truck.statusNote}`} actions={<Button asChild variant="outline" className="h-10"><Link href={`/trucks${preservedQuery(filters)}`}>All trucks</Link></Button>} />
      <div className="flex flex-wrap items-center gap-3"><StatusPill status={truck.status} /><span className="text-sm text-muted-foreground">Your entitlement {truck.entitlement} · reserve {truck.reserve}</span></div>
      <p className="text-sm text-muted-foreground">FSSAI {truck.fssai} · GSTIN {truck.gstin} · {truck.latitude.toFixed(4)}° N, {truck.longitude.toFixed(4)}° E</p>
      <Suspense><FilterBar trucks={choices.trucks} truck={truck.id} /></Suspense>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Eligible sales", truck.revenue.formatted],
          ["Operating and food costs", truck.expenses.formatted],
          ["Charity allocation", truck.charity.formatted],
          ["Distributable profit", truck.profit.formatted],
          ["Your earnings", truck.earnings.formatted],
          ["Meals sold", truck.sold.toLocaleString("en-IN")],
          ["Meals dispatched", truck.dispatched.toLocaleString("en-IN")],
          ["Closing stock", truck.stock.toLocaleString("en-IN")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 font-heading text-2xl tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sales comparison"><CompareBars data={truck.months} xKey="label" bars={[{ key: "sales", name: "Eligible sales", color: "var(--primary)" }]} /></Panel>
        <Panel title="Inventory reconciliation" description="Meals received from the central kitchen in Thiruvananthapuram, compared with meals sold, donated, wasted and returned.">
          <CountBars data={truck.months} bars={[{ key: "received", name: "Received", color: "var(--primary)" }, { key: "sold", name: "Sold", color: "var(--gold)" }, { key: "donated", name: "Donated", color: "var(--chart-3)" }]} />
        </Panel>
      </div>
      <Panel title="Product stock">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Food item</TableHead>
              <TableHead>Opening</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Sold</TableHead>
              <TableHead>Donated</TableHead>
              <TableHead>Wasted</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead>Closing</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {truck.inventory.map((row) => (
              <TableRow key={row.productId}>
                <TableCell>{row.product}</TableCell>
                <TableCell>{row.opening}</TableCell>
                <TableCell>{row.received}</TableCell>
                <TableCell>{row.sold}</TableCell>
                <TableCell>{row.donated}</TableCell>
                <TableCell>{row.wasted}</TableCell>
                <TableCell>{row.returned}</TableCell>
                <TableCell>{row.closing}</TableCell>
                <TableCell><Button asChild size="sm" variant="ghost"><Link href={`/inventory/${row.truckId}/${row.productId}${preservedQuery(filters)}`}>Movements</Link></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
