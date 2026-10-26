"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { recordSaleAction } from "@/lib/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaleBoard } from "@/components/desk/sale-board";

export function SellerDesk({
  truckName,
  truckCode,
  location,
  statusNote,
}: {
  truckName: string;
  truckCode: string;
  location: string;
  statusNote: string;
}) {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [camera, setCamera] = useState("Starting the camera…");
  const [last, setLast] = useState<{ saleNumber: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quantityRef = useRef(1);
  const lastScan = useRef({ code: "", at: 0 });
  const recording = useRef(false);

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  async function sell(raw: string) {
    const next = raw.trim();
    const now = Date.now();
    if (!next) return;
    if (next === lastScan.current.code && now - lastScan.current.at < 2000) return;
    if (recording.current) return;
    lastScan.current = { code: next, at: now };
    recording.current = true;
    setBusy(true);
    setError(null);
    const result = await recordSaleAction({ code: next, quantity: quantityRef.current });
    recording.current = false;
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    const detail = `${result.ticket.quantity} × ${result.ticket.productName} · ${result.ticket.amount}`;
    setLast({ saleNumber: result.ticket.saleNumber, detail });
    setCode("");
    toast.success(`Sale ${result.ticket.saleNumber}`, { description: detail });
  }

  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode("meal-reader");
        scanner = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => {
            void sell(text);
          },
          () => undefined,
        );
        if (!cancelled) setCamera("Point the camera at the customer’s meal QR.");
      } catch {
        if (!cancelled) setCamera("This browser has no camera. Paste the meal code from the customer menu.");
      }
    })();
    return () => {
      cancelled = true;
      void scanner?.stop().catch(() => undefined);
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <div id="meal-reader" className="min-h-64 overflow-hidden rounded-xl border border-border bg-black" />
          <p className="mt-2 text-sm text-muted-foreground">{camera}</p>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-gold uppercase">Truck {truckCode}</p>
            <h1 className="mt-1 font-heading text-3xl">{truckName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{location}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{statusNote}</p>
          </div>
          {last && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Latest sale number</p>
              <p className="mt-1 font-heading text-4xl">{last.saleNumber}</p>
              <p className="mt-1 text-sm">{last.detail}</p>
            </div>
          )}
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sell(code);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="meal-code">Meal code</Label>
              <Input id="meal-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="FD1|A|prod-shawarma" className="h-10 font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">How many</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="h-10 w-28"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? "Recording" : "Record sale"}</Button>
          </form>
        </div>
      </section>
      <SaleBoard title="Sales from this truck" detail="Each scan gets its own sale number. The investor for this truck, the admin, and the super admin see the same number and the same meal count." />
    </div>
  );
}
