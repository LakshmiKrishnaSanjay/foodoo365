"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BellNotice } from "@/lib/data/queries";
import { cn } from "cn";

type LiveTicket = {
  saleNumber: string;
  truckName: string;
  productName: string;
  quantity: number;
  amount: string;
};

type Item = BellNotice & { live?: boolean };

export function NotificationBell({
  investorId,
  notices,
  unread,
}: {
  investorId: string;
  notices: BellNotice[];
  unread: number;
}) {
  const [live, setLive] = useState<Item[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    seen.current = new Set();
    primed.current = false;

    let stopped = false;

    async function poll() {
      const response = await fetch("/api/live-orders", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const data = (await response.json()) as { tickets?: LiveTicket[] };
      const tickets = data.tickets ?? [];
      if (!primed.current) {
        primed.current = true;
        seen.current = new Set(tickets.map((ticket) => ticket.saleNumber));
        return;
      }
      const arrivals = tickets.filter((ticket) => !seen.current.has(ticket.saleNumber));
      seen.current = new Set(tickets.map((ticket) => ticket.saleNumber));
      if (arrivals.length === 0) return;
      setFresh((current) => [...arrivals.map((ticket) => ticket.saleNumber), ...current].slice(0, 12));
      setLive((current) => [
        ...arrivals.map((ticket) => ({
          id: ticket.saleNumber,
          title: `Sale ${ticket.saleNumber}`,
          body: `${ticket.quantity} × ${ticket.productName} at ${ticket.truckName}. ${ticket.amount}.`,
          href: "/sales",
          unread: true,
          createdLabel: "Just now",
          live: true,
        })),
        ...current,
      ].slice(0, 8));
      setPulse(true);
      window.setTimeout(() => setPulse(false), 2500);
      for (const ticket of arrivals) {
        toast(`Sale ${ticket.saleNumber}`, {
          description: `${ticket.quantity} × ${ticket.productName} at ${ticket.truckName}. ${ticket.amount}.`,
        });
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [investorId]);

  function markLiveRead(id: string) {
    setFresh((current) => current.filter((saleNumber) => saleNumber !== id));
    setLive((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  }

  const items: Item[] = [...live, ...notices];
  const count = unread + fresh.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={count > 0 ? `${count} notifications` : "Notifications"}>
          <Bell className={cn(pulse && "animate-pulse")} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">{count > 0 ? `${count} unread` : "All caught up"}</p>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-sm text-muted-foreground">No notifications yet.</li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="border-b border-border last:border-0">
                <Link
                  href={item.href}
                  onClick={() => {
                    if (item.live) markLiveRead(item.id);
                  }}
                  className="block px-3 py-3 hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    {(item.live ? fresh.includes(item.id) : item.unread) && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.body}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{item.createdLabel}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
        <Link href="/notifications" className="block border-t border-border px-3 py-2 text-center text-sm text-primary">
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
