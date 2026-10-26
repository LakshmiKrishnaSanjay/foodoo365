import { Suspense } from "react";
import { PageIntro, PageSkeleton, Panel } from "@/components/portal/bits";
import { FilterBar } from "@/components/portal/filters";
import { Waterfall } from "@/components/portal/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProfit } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Profit & Earnings" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><ProfitPage searchParams={props.searchParams} /></Suspense>;
}

async function ProfitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters, choices } = await readRequest(searchParams);
  const data = await getProfit(session.id, filters);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <PageIntro title="Profit and earnings" description="Profit is not a share of revenue. Eligible sales are reduced by the 20% charity allocation, food cost of meals sold, operating expenses, other approved costs and reserves. Your earnings are your contractual share of what remains. A loss does not create a payout." />
      <Suspense><FilterBar trucks={choices.trucks} truck={filters.truck} /></Suspense>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Selected revenue", data.comparison.revenue],
          ["Selected distributable profit", data.comparison.profit],
          ["Your share for these dates", data.comparison.earnings],
        ].map(([label, value]) => {
          const item = value as { current: { formatted: string }; delta: { text: string } | null };
          return (
            <div key={String(label)} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{String(label)}</p>
              <p className="mt-2 font-heading text-2xl tabular-nums">{item.current.formatted}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.delta ? `${item.delta.text} vs prior period` : "No comparable prior period"}</p>
            </div>
          );
        })}
      </div>
      <Panel title="Profit waterfall" description="The selected dates are calculated from source transactions. Loss carryforward is applied in the accounting-period table, which is the payout basis.">
        <Waterfall steps={data.steps} />
        <p className="mt-4 text-sm text-muted-foreground">{data.valid ? "Contracted profit entitlements on these trucks total 100% or less." : "An entitlement check failed. Earnings should not be approved until the agreements are corrected."}</p>
      </Panel>
      <Panel title="Accounting periods" description="Approved earnings are zero while a period is open, and zero when the result after carryforward is negative. September payouts are partially paid, with the remainder scheduled.">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Mini label="Revenue in these periods" value={data.yearly.revenue.formatted} />
          <Mini label="Distributable profit" value={data.yearly.distributable.formatted} />
          <Mini label="Earned / approved / paid" value={`${data.yearly.earned.formatted} · ${data.yearly.approved.formatted} · ${data.yearly.paid.formatted}`} />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Truck and period</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Charity</TableHead>
              <TableHead>Direct costs</TableHead>
              <TableHead>Operating expenses</TableHead>
              <TableHead>Operating profit</TableHead>
              <TableHead>Distributable</TableHead>
              <TableHead>Your share</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.ledger.map((row) => (
              <TableRow key={`${row.truck}-${row.period}`}>
                <TableCell>
                  {row.truck}
                  <span className="mt-1 block text-xs text-muted-foreground">{row.period} · {row.status}{row.lossCarryforward ? " · carryforward on" : ""}</span>
                </TableCell>
                <TableCell className="tabular-nums">{row.revenue.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.charity.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.direct.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.operating.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.operatingProfit.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.distributable.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.share.formatted}{row.carryforward.zero ? "" : <span className="mt-1 block text-xs text-muted-foreground">Carryforward {row.carryforward.formatted}</span>}</TableCell>
                <TableCell className="tabular-nums">{row.approved.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.paid.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.outstanding.formatted}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.ledger.filter((row) => row.adjustments.length > 0 || row.status === "finalized").slice(0, 4).map((row) => (
          <Panel key={`${row.truck}-${row.period}-audit`} title={`${row.truck} · ${row.period}`} description={row.snapshotNote}>
            <ul className="space-y-2 text-sm">
              {row.audit.map((line) => (
                <li key={line.step} className="flex justify-between gap-4 border-b border-border pb-2">
                  <span><span className="block font-medium">{line.step}</span><span className="text-muted-foreground">{line.detail}</span></span>
                  <span className="shrink-0 tabular-nums">{line.amount.formatted}</span>
                </li>
              ))}
            </ul>
            {row.adjustments.map((adjustment) => (
              <p key={adjustment.reference} className="mt-3 text-sm text-muted-foreground">{adjustment.date}: {adjustment.reference} changes distributable profit by {adjustment.amount.signed}. {adjustment.reason}</p>
            ))}
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted px-3 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium tabular-nums">{value}</p></div>;
}
