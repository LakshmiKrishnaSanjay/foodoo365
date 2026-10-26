import Link from "next/link";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MoneyView } from "@/lib/money";
import type { Delta } from "@/lib/data/present";

export function PageIntro({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="font-heading text-3xl tracking-tight text-foreground md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = status === "active" || status === "paid" || status === "distributed" || status === "finalized"
    ? "bg-positive/10 text-positive"
    : status === "maintenance" || status === "approved" || status === "prepared" || status === "open"
      ? "bg-gold/15 text-gold"
      : status === "sponsored"
        ? "bg-secondary text-secondary-foreground"
        : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cn("h-6 border-transparent capitalize", tone)}>{status}</Badge>;
}

export function TruckMark({ code }: { code: string }) {
  return (
    <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
      <svg viewBox="0 0 48 48" className="size-8" aria-hidden="true">
        <rect x="4" y="18" width="26" height="14" rx="3" fill="currentColor" opacity="0.9" />
        <path d="M30 22h8l4 6v4h-12V22z" fill="currentColor" />
        <circle cx="14" cy="34" r="3" fill="var(--gold)" />
        <circle cx="34" cy="34" r="3" fill="var(--gold)" />
        <text x="10" y="28" fontSize="8" fill="var(--primary-foreground)">{code}</text>
      </svg>
    </span>
  );
}

export function Waterfall({ steps }: { steps: Array<{ label: string; amount: MoneyView; kind: "total" | "decrease" | "increase" | "result" | "gold" }> }) {
  const max = Math.max(...steps.map((step) => Math.abs(step.amount.chart)), 1);
  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <div key={step.label} className="grid items-center gap-3 sm:grid-cols-[13rem_1fr_8.5rem]">
          <p className="text-sm text-foreground">{step.label}</p>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                step.kind === "decrease" && "bg-destructive/70",
                step.kind === "total" && "bg-primary",
                step.kind === "increase" && "bg-positive",
                step.kind === "result" && "bg-primary",
                step.kind === "gold" && "bg-gold",
              )}
              style={{ width: `${Math.max(3, (Math.abs(step.amount.chart) / max) * 100)}%` }}
            />
          </div>
          <p className={cn("text-right text-sm font-medium tabular-nums", step.amount.negative && "text-destructive", step.kind === "gold" && "text-gold")}>{step.amount.formatted}</p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <h2 className="font-heading text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

export function Pager({ page, pages, total, hrefFor }: { page: number; pages: number; total: number; hrefFor: (page: number) => string }) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">{total.toLocaleString("en-IN")} records · page {page} of {pages}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" className="h-9" asChild><Link href={hrefFor(page - 1)}>Previous</Link></Button>
        ) : (
          <Button variant="outline" className="h-9" disabled>Previous</Button>
        )}
        {page < pages ? (
          <Button variant="outline" className="h-9" asChild><Link href={hrefFor(page + 1)}>Next</Link></Button>
        ) : (
          <Button variant="outline" className="h-9" disabled>Next</Button>
        )}
      </div>
    </div>
  );
}

export function Panel({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1 max-w-2xl leading-6">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DeltaChip({ delta }: { delta: Delta | null }) {
  if (!delta) return <p className="text-xs text-muted-foreground">No comparable prior period</p>;
  return (
    <p className={cn("text-xs font-medium", delta.tone === "up" && "text-positive", delta.tone === "down" && "text-destructive", delta.tone === "flat" && "text-muted-foreground")}>
      {delta.text} vs prior period
    </p>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
