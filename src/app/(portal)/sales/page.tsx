import { Suspense } from "react";
import { CompareBars, TrendChart } from "@/components/portal/charts";
import { EmptyState, PageIntro, PageSkeleton, Pager, Panel } from "@/components/portal/bits";
import { FilterBar } from "@/components/portal/filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSales, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Sales & Revenue" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><SalesPage searchParams={props.searchParams} /></Suspense>;
}

async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters, choices } = await readRequest(searchParams);
  const data = await getSales(session.id, filters);
  if (!data) return null;
  const topName = data.top[0]?.name ?? "None in this range";
  return (
    <div className="space-y-6">
      <PageIntro title="Sales and revenue" description="Eligible revenue is menu sales after discounts and refunds. GST collected for the authorities is excluded, and it is not investor profit." />
      <Suspense><FilterBar trucks={choices.trucks} categories={choices.categories} truck={filters.truck} category={filters.category} q={filters.q} showCategory showSearch /></Suspense>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Gross sales", data.gross.formatted],
          ["Discounts", data.discounts.formatted],
          ["Refunds", data.refunds.formatted],
          ["Net eligible sales", data.eligible.formatted],
          ["Charity allocation", data.charity.formatted],
          ["Meals sold", data.meals.toLocaleString("en-IN")],
          ["Average order value", data.average.formatted],
          ["Highest selling meal", topName],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 font-heading text-2xl">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Daily revenue"><TrendChart data={data.daily} series={[{ key: "revenue", name: "Eligible revenue", color: "var(--primary)" }]} /></Panel>
        <Panel title="Monthly revenue"><CompareBars data={data.monthly} xKey="label" bars={[{ key: "revenue", name: "Eligible revenue", color: "var(--primary)" }]} /></Panel>
        <Panel title="Food category revenue"><CompareBars data={data.categories} bars={[{ key: "value", name: "Eligible revenue", color: "var(--gold)" }]} /></Panel>
        <Panel title="Truck-wise sales"><CompareBars data={data.trucks} bars={[{ key: "value", name: "Eligible revenue", color: "var(--primary)" }]} /></Panel>
      </div>
      <Panel title="Top selling meals"><CompareBars data={data.top} bars={[{ key: "revenue", name: "Eligible revenue", color: "var(--positive)" }]} /></Panel>
      <Panel title="Item-level sales">
        {data.table.total === 0 ? <EmptyState title="No sales match" body="Try another truck, category or date range." /> : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Truck</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Refund</TableHead>
                  <TableHead>Eligible revenue</TableHead>
                  <TableHead>Charity</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.table.rows.map((row) => (
                  <TableRow key={`${row.reference}-${row.date}`}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.product}</TableCell>
                    <TableCell>{row.truck}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell className="tabular-nums">{row.price.formatted}</TableCell>
                    <TableCell className="tabular-nums">{row.discount.formatted}</TableCell>
                    <TableCell className="tabular-nums">{row.refund.formatted}</TableCell>
                    <TableCell className="tabular-nums">{row.eligible.formatted}</TableCell>
                    <TableCell className="tabular-nums">{row.charity.formatted}</TableCell>
                    <TableCell>{row.reference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={data.table.page} pages={data.table.pages} total={data.table.total} hrefFor={(page) => `/sales${preservedQuery(filters, { page: String(page) })}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
