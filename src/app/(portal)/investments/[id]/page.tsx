import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageIntro, PageSkeleton, Panel, StatusPill } from "@/components/portal/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInvestmentDetail } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Investment" };

export default function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><Detail params={props.params} searchParams={props.searchParams} /></Suspense>;
}

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session } = await readRequest(searchParams);
  const investment = await getInvestmentDetail(session.id, (await params).id);
  if (!investment) notFound();
  return (
    <div className="space-y-6">
      <PageIntro title={investment.agreementRef} description={`${investment.truck} · invested ${investment.date}. This agreement belongs to your account and is not visible to other investors.`} actions={<Button asChild variant="outline" className="h-10"><Link href={`/trucks/${investment.truckId}`}>Truck performance</Link></Button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Invested", investment.amount.formatted],
          ["Ownership", investment.ownership],
          ["Profit entitlement", investment.entitlement],
          ["Status", investment.status],
          ["Cumulative earnings", investment.earningsTotal.formatted],
          ["Payouts received", investment.paid.formatted],
          ["Unpaid approved earnings", investment.unpaid.formatted],
          ["Loss carryforward", investment.lossCarryforward ? "Enabled" : "Not enabled"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 font-heading text-xl capitalize">{value}</p>
          </div>
        ))}
      </div>
      <Panel title="Agreement" description="Ownership can differ from the contractual profit entitlement. Earnings use the entitlement only.">
        <div className="flex items-center gap-2"><StatusPill status={investment.status} /><span className="text-sm text-muted-foreground">{investment.location}</span></div>
        <p className="mt-3 max-w-3xl text-sm leading-6">{investment.notes}</p>
      </Panel>
      <Panel title="Earnings history and financial statements" description="Each finalized month keeps a snapshot. A later correction is a controlled adjustment, not a silent overwrite.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Distributable</TableHead>
              <TableHead>Your share</TableHead>
              <TableHead>Carryforward</TableHead>
              <TableHead>Earned</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {investment.history.map((row) => (
              <TableRow key={row.period}>
                <TableCell>{row.period}<span className="mt-1 block text-xs text-muted-foreground capitalize">{row.status}{row.snapshotMatches ? "" : " · review snapshot"}</span></TableCell>
                <TableCell className="tabular-nums">{row.revenue.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.distributable.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.share.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.carryforward.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.earned.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.approved.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.paid.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.outstanding.formatted}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel title="Payout history">
        {investment.payouts.length === 0 ? <p className="text-sm text-muted-foreground">No payout has been recorded for this investment.</p> : (
          <ul className="divide-y divide-border">
            {investment.payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{payout.reference}</p>
                  <p className="text-muted-foreground">{payout.date} · {payout.note}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{payout.amount.formatted}</p>
                  <StatusPill status={payout.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
