"use client";

import { useEffect, useState } from "react";

export interface LiveTicket {
  saleNumber: string;
  truckName: string;
  truckCode: string;
  productName: string;
  quantity: number;
  amount: string;
  sellerName: string;
  soldAt: string;
}

export function SaleBoard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  const [meals, setMeals] = useState(0);
  const [sales, setSales] = useState(0);
  const [tickets, setTickets] = useState<LiveTicket[]>([]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      const response = await fetch("/api/live-orders", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const data = (await response.json()) as { meals: number; sales: number; tickets: LiveTicket[] };
      setMeals(data.meals);
      setSales(data.sales);
      setTickets(data.tickets);
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Meals scanned</p>
          <p className="mt-2 font-heading text-4xl">{meals}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Sale numbers</p>
          <p className="mt-2 font-heading text-4xl">{sales}</p>
        </article>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Sale number</th>
              <th className="px-3 py-2 font-medium">Truck</th>
              <th className="px-3 py-2 font-medium">Meal</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Seller</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-muted-foreground">No scanned sales yet. They appear here as soon as a truck seller scans a meal QR.</td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.saleNumber} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{ticket.saleNumber}</td>
                  <td className="px-3 py-2">{ticket.truckCode} · {ticket.truckName}</td>
                  <td className="px-3 py-2">{ticket.productName}</td>
                  <td className="px-3 py-2">{ticket.quantity}</td>
                  <td className="px-3 py-2">{ticket.amount}</td>
                  <td className="px-3 py-2">{ticket.sellerName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
