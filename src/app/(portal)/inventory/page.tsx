import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageIntro, PageSkeleton, Pager, Panel } from "@/components/portal/bits";
import { FilterBar } from "@/components/portal/filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventory, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Inventory & Meals" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><InventoryPage searchParams={props.searchParams} /></Suspense>;
}

async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters, choices } = await readRequest(searchParams);
  const data = await getInventory(session.id, filters);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <PageIntro title="Inventory and meals" description="The central kitchen in Thiruvananthapuram dispatches meals to the trucks. This portal is read-only. Closing stock is opening plus receipts, minus sold, donated, wasted and returned meals, adjusted for transfers." />
      <Suspense><FilterBar trucks={choices.trucks} truck={filters.truck} q={filters.q} showSearch /></Suspense>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Meals dispatched", data.dispatched],
          ["Meals received", data.received],
          ["Meals sold", data.sold],
          ["Meals donated", data.donated],
          ["Meals returned", data.returned],
          ["Meals wasted", data.wasted],
          ["Closing stock", data.closing],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 font-heading text-2xl tabular-nums">{Number(value).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
      <Panel title="Product inventory" description="Open a row to see the movements behind the figures.">
        {data.table.total === 0 ? <EmptyState title="No inventory rows" body="No meals match this truck or search." /> : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Food item</TableHead>
                  <TableHead>Truck</TableHead>
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
                {data.table.rows.map((row) => (
                  <TableRow key={`${row.truckId}-${row.productId}`}>
                    <TableCell>{row.product}</TableCell>
                    <TableCell>{row.truck}</TableCell>
                    <TableCell>{row.opening}</TableCell>
                    <TableCell>{row.received}</TableCell>
                    <TableCell>{row.sold}</TableCell>
                    <TableCell>{row.donated}</TableCell>
                    <TableCell>{row.wasted}</TableCell>
                    <TableCell>{row.returned}</TableCell>
                    <TableCell>{row.closing}</TableCell>
                    <TableCell><Button asChild size="sm" variant="outline"><Link href={`/inventory/${row.truckId}/${row.productId}${preservedQuery(filters)}`}>Drill down</Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={data.table.page} pages={data.table.pages} total={data.table.total} hrefFor={(page) => `/inventory${preservedQuery(filters, { page: String(page) })}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
