import { Suspense } from "react";
import { EmptyState, PageIntro, PageSkeleton, Pager } from "@/components/portal/bits";
import { FilterBar } from "@/components/portal/filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTransactions, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Transactions" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><TransactionsPage searchParams={props.searchParams} /></Suspense>;
}

async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters, choices } = await readRequest(searchParams);
  const data = await getTransactions(session.id, filters);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <PageIntro title="Transactions" description="Sales are summarised by truck and day. Expenses, charity allocations, payouts, capital and controlled adjustments are listed individually. Rejected entries are excluded from profit." />
      <Suspense>
        <FilterBar
          trucks={choices.trucks}
          truck={filters.truck}
          q={filters.q}
          type={filters.type}
          status={filters.status}
          showSearch
          showType
          showStatus
          types={["Sale", "Expense", "Charity", "Payout", "Capital", "Adjustment", "Rejected"]}
          statuses={["Recorded", "Approved", "Paid", "Allocated", "Rejected", "Funded"]}
        />
      </Suspense>
      {data.total === 0 ? <EmptyState title="No transactions" body="Nothing matches this search, truck, type or date range." /> : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Truck</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell>{row.dateLabel}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.truck}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.reference}</TableCell>
                    <TableCell className="tabular-nums">{row.amount.formatted}</TableCell>
                    <TableCell>{row.direction}</TableCell>
                    <TableCell>{row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} hrefFor={(page) => `/transactions${preservedQuery(filters, { page: String(page) })}`} />
        </div>
      )}
    </div>
  );
}
