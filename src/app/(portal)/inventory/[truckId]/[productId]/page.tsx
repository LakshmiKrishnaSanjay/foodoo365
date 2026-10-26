import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageIntro, PageSkeleton, Panel } from "@/components/portal/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryDrill, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Inventory movements" };

export default function Page(props: { params: Promise<{ truckId: string; productId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><Drill params={props.params} searchParams={props.searchParams} /></Suspense>;
}

async function Drill({ params, searchParams }: { params: Promise<{ truckId: string; productId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters } = await readRequest(searchParams);
  const { truckId, productId } = await params;
  const data = await getInventoryDrill(session.id, truckId, productId, filters);
  if (!data) notFound();
  const row = data.row;
  const formula = `${row.opening} + ${row.received} − ${row.sold} − ${row.donated} − ${row.wasted} − ${row.returned} − ${row.transferredOut} + ${row.transferredIn} = ${row.closing}`;
  return (
    <div className="space-y-6">
      <PageIntro title={row.product} description={`${row.truck}. These movements explain the stock totals. The portal cannot change inventory.`} actions={<Button asChild variant="outline" className="h-10"><Link href={`/inventory${preservedQuery(filters)}`}>Back to inventory</Link></Button>} />
      <Panel title="Reconciliation" description="Closing stock = opening + received − sold − donated − wasted − returned − transferred out + transferred in.">
        <p className="font-medium tabular-nums">{formula}</p>
        <p className="mt-2 text-sm text-muted-foreground">{row.balanced ? "The row balances." : "This row does not balance and should be reviewed."}</p>
      </Panel>
      <Panel title="Movements">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{movement.date}</TableCell>
                <TableCell className="capitalize">{movement.type}</TableCell>
                <TableCell>{movement.quantity}</TableCell>
                <TableCell>{movement.reference}</TableCell>
                <TableCell>{movement.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
