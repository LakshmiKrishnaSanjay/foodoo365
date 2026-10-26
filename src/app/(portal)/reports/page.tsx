import Link from "next/link";
import { Suspense } from "react";
import { PageIntro, PageSkeleton, Panel } from "@/components/portal/bits";
import { ReportActions } from "@/components/portal/report-actions";
import { getCharity, getInventory, getInvestments, getProfit, preservedQuery } from "@/lib/data/queries";
import { readRequest } from "@/lib/portal-request";
import { cn } from "cn";

export const metadata = { title: "Reports" };

const REPORTS = [
  { id: "position", label: "Investment position" },
  { id: "profit", label: "Profit statement" },
  { id: "earnings", label: "Earnings and payouts" },
  { id: "charity", label: "Charity statement" },
  { id: "inventory", label: "Inventory reconciliation" },
];

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><ReportsPage searchParams={props.searchParams} /></Suspense>;
}

async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters } = await readRequest(searchParams);
  const report = REPORTS.some((item) => item.id === filters.report) ? filters.report : "position";
  const investments = await getInvestments(session.id);
  const profit = await getProfit(session.id, filters);
  const charity = await getCharity(session.id, filters);
  const inventory = await getInventory(session.id, { ...filters, page: 1, pageSize: 500 });
  if (!investments || !profit || !charity || !inventory) return null;

  const sheets = {
    position: {
      headers: ["Investment", "Truck", "Date", "Invested", "Ownership", "Entitlement", "Earnings", "Paid", "Unpaid"],
      rows: investments.map((row) => [row.id, row.truck, row.date, row.amount.formatted, row.ownership, row.entitlement, row.earnings.formatted, row.paid.formatted, row.unpaid.formatted]),
    },
    profit: {
      headers: ["Step", "Amount"],
      rows: profit.steps.map((step) => [step.label, step.amount.formatted]),
    },
    earnings: {
      headers: ["Truck", "Period", "Revenue", "Distributable", "Share", "Approved", "Paid", "Outstanding"],
      rows: profit.ledger.map((row) => [row.truck, row.period, row.revenue.formatted, row.distributable.formatted, row.earned.formatted, row.approved.formatted, row.paid.formatted, row.outstanding.formatted]),
    },
    charity: {
      headers: ["Date", "Truck", "Status", "Meals", "Amount", "Reference"],
      rows: charity.history.map((row) => [row.date, row.truck, row.status, String(row.meals), row.amount.formatted, row.reference]),
    },
    inventory: {
      headers: ["Item", "Truck", "Opening", "Received", "Sold", "Donated", "Wasted", "Returned", "Closing"],
      rows: inventory.table.rows.map((row) => [row.product, row.truck, String(row.opening), String(row.received), String(row.sold), String(row.donated), String(row.wasted), String(row.returned), String(row.closing)]),
    },
  } as const;
  const sheet = sheets[report as keyof typeof sheets];

  return (
    <div className="space-y-6">
      <PageIntro title="Reports" description={`Prepared for ${session.fullName}. Figures use the selected dates and are labelled demonstration data.`} actions={<ReportActions filename={`foodoo365-${report}-demo.csv`} headers={[...sheet.headers]} rows={sheet.rows.map((row) => [...row])} />} />
      <div className="no-print flex flex-wrap gap-2">
        {REPORTS.map((item) => (
          <Link key={item.id} href={`/reports${preservedQuery(filters, { report: item.id })}`} className={cn("rounded-lg px-3 py-2 text-sm", report === item.id ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-foreground/10")}>{item.label}</Link>
        ))}
      </div>
      <Panel title={REPORTS.find((item) => item.id === report)?.label ?? "Report"} description="This statement is generated from the same calculation engine as the dashboards.">
        <p className="mb-4 text-sm text-muted-foreground">Demonstration data · not actual Foodoo365 performance · {filters.from} to {filters.to}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {sheet.headers.map((header) => <th key={header} className="px-2 py-2 font-medium">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, index) => (
                <tr key={index} className="border-b border-border">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2 tabular-nums">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
