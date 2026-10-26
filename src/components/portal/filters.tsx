"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { id: "30", label: "Last 30 days", from: "2026-09-26", to: "2026-10-25" },
  { id: "90", label: "Last 90 days", from: "2026-07-28", to: "2026-10-25" },
  { id: "month", label: "October", from: "2026-10-01", to: "2026-10-25" },
  { id: "sep", label: "September", from: "2026-09-01", to: "2026-09-30" },
  { id: "all", label: "All demo data", from: "2026-05-01", to: "2026-10-25" },
];

export function DateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const from = params.get("from") ?? "2026-09-26";
  const to = params.get("to") ?? "2026-10-25";

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(params.toString());
    next.set("from", nextFrom);
    next.set("to", nextTo);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const preset = PRESETS.find((item) => item.from === from && item.to === to)?.id ?? "custom";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="date-preset">Date range</label>
      <select
        id="date-preset"
        className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
        value={preset}
        onChange={(event) => {
          const match = PRESETS.find((item) => item.id === event.target.value);
          if (match) apply(match.from, match.to);
        }}
      >
        {PRESETS.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
        <option value="custom">Custom range</option>
      </select>
      <Input type="date" aria-label="From date" min="2026-05-01" max="2026-10-25" value={from} className="h-10 w-[9.5rem] bg-card" onChange={(event) => apply(event.target.value, to)} />
      <span className="text-xs text-muted-foreground">to</span>
      <Input type="date" aria-label="To date" min="2026-05-01" max="2026-10-25" value={to} className="h-10 w-[9.5rem] bg-card" onChange={(event) => apply(from, event.target.value)} />
    </div>
  );
}

export function FilterBar({
  trucks,
  categories = [],
  truck,
  category = "all",
  q = "",
  type = "all",
  status = "all",
  types = [],
  statuses = [],
  showCategory,
  showSearch,
  showType,
  showStatus,
}: {
  trucks: Array<{ id: string; label: string }>;
  categories?: string[];
  truck: string;
  category?: string;
  q?: string;
  type?: string;
  status?: string;
  types?: string[];
  statuses?: string[];
  showCategory?: boolean;
  showSearch?: boolean;
  showType?: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(q);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form
      className="no-print flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setParam("q", query.trim());
      }}
    >
      <select className="h-10 rounded-lg border border-input bg-card px-2 text-sm" aria-label="Truck" value={trucks.some((item) => item.id === truck) ? truck : "all"} onChange={(event) => setParam("truck", event.target.value)}>
        <option value="all">All my trucks</option>
        {trucks.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      {showCategory && (
        <select className="h-10 rounded-lg border border-input bg-card px-2 text-sm" aria-label="Meal category" value={category} onChange={(event) => setParam("category", event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      )}
      {showType && (
        <select className="h-10 rounded-lg border border-input bg-card px-2 text-sm" aria-label="Transaction type" value={type} onChange={(event) => setParam("type", event.target.value)}>
          <option value="all">All types</option>
          {types.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      )}
      {showStatus && (
        <select className="h-10 rounded-lg border border-input bg-card px-2 text-sm" aria-label="Status" value={status} onChange={(event) => setParam("status", event.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      )}
      {showSearch && (
        <>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search" className="h-10 w-48 bg-card" />
          <Button type="submit" variant="outline" className="h-10">Search</Button>
        </>
      )}
    </form>
  );
}
