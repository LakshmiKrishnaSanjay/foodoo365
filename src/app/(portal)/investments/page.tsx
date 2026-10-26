import Link from "next/link";
import { Suspense } from "react";
import { PageIntro, PageSkeleton, StatusPill } from "@/components/portal/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInvestments } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "My Investments" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><InvestmentsPage searchParams={props.searchParams} /></Suspense>;
}

async function InvestmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session } = await readRequest(searchParams);
  const rows = await getInvestments(session.id);
  if (!rows) return null;
  return (
    <div className="space-y-6">
      <PageIntro title="My investments" description="Ownership and profit entitlement are recorded separately. The entitlement percentage is the contractual profit share. It is not calculated by dividing your capital by the truck's total capital." />
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investment</TableHead>
              <TableHead>Truck</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Invested</TableHead>
              <TableHead>Ownership</TableHead>
              <TableHead>Entitlement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Unpaid</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.id}</TableCell>
                <TableCell>{row.truck}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell className="tabular-nums">{row.amount.formatted}</TableCell>
                <TableCell>{row.ownership}</TableCell>
                <TableCell className="text-gold">{row.entitlement}</TableCell>
                <TableCell><StatusPill status={row.status} /></TableCell>
                <TableCell className="tabular-nums">{row.earnings.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.paid.formatted}</TableCell>
                <TableCell className="tabular-nums">{row.unpaid.formatted}</TableCell>
                <TableCell><Button asChild variant="outline" size="sm"><Link href={`/investments/${row.id}`}>Details</Link></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
