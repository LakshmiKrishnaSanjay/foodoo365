"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const [cameraTry, setCameraTry] = useState(0);
  const quantityRef = useRef(1);
  const lastScan = useRef({ code: "", at: 0 });
  const recording = useRef(false);
  const regionId = `meal-reader-${useId().replace(/:/g, "")}`;
  const fileRegionId = `${regionId}-file`;

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  const sellRef = useRef<(raw: string) => Promise<void>>(async () => undefined);
  const scanGate = useRef({ ready: true, misses: 0 });
  const cameraRelease = useRef<Promise<void>>(Promise.resolve());

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

  sellRef.current = sell;

  useEffect(() => {
    let alive = true;
    let scanner: { isScanning: boolean; stop: () => Promise<void>; clear: () => void } | null = null;
    let starting: Promise<void> | null = null;
    const previous = cameraRelease.current;
    let release: () => void = () => undefined;
    cameraRelease.current = new Promise((resolve) => {
      release = resolve;
    });

    starting = (async () => {
      await previous.catch(() => undefined);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      if (!alive) return;
      if (!window.isSecureContext) {
        setCamera("The camera needs localhost or https. On this computer open http://localhost:3000. A phone address such as 10.x will block the camera.");
        return;
      }
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!alive) return;
      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
      ];
      const instance = new Html5Qrcode(regionId, { verbose: false, formatsToSupport: formats, useBarCodeDetectorIfSupported: true });
      scanner = instance;
      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      if (!alive) return;
      const back = cameras.find((item) => /back|rear|environment/i.test(item.label));
      const attempts: Array<string | MediaTrackConstraints> = [];
      if (back) attempts.push(back.id);
      for (const item of cameras) {
        if (item.id !== back?.id) attempts.push(item.id);
      }
      if (attempts.length === 0) {
        attempts.push({ facingMode: "user" });
        attempts.push({ facingMode: "environment" });
      }
      let lastError: unknown = null;
      for (const camera of attempts) {
        if (!alive) return;
        try {
          await instance.start(
            camera,
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.max(50, Math.floor(Math.min(width, height) * 0.82));
                return { width: Math.min(size, width), height: Math.min(size, height) };
              },
            },
            (text) => {
              if (!scanGate.current.ready) return;
              scanGate.current.ready = false;
              scanGate.current.misses = 0;
              void sellRef.current(text);
            },
            () => {
              if (scanGate.current.ready) return;
              scanGate.current.misses += 1;
              if (scanGate.current.misses >= 8) scanGate.current.ready = true;
            },
          );
          if (!alive) {
            if (instance.isScanning) await instance.stop().catch(() => undefined);
            return;
          }
          setCamera("Point the camera at the meal QR or barcode.");
          return;
        } catch (error) {
          lastError = error;
          if (instance.isScanning) await instance.stop().catch(() => undefined);
        }
      }
      if (!alive) return;
      const message = lastError instanceof Error ? lastError.message : "";
      if (/notallowed|permission|denied/i.test(message)) {
        setCamera("The browser blocked the camera. Allow camera access, then press Try camera again.");
      } else if (cameras.length === 0) {
        setCamera("No camera was found. Paste the meal code, or connect a camera and press Try camera again.");
      } else {
        setCamera("The camera did not start. Paste the meal code, or press Try camera again.");
      }
    })();

    return () => {
      alive = false;
      void starting?.catch(() => undefined).finally(async () => {
        if (scanner?.isScanning) await scanner.stop().catch(() => undefined);
        try {
          scanner?.clear();
        } catch {
          /* The preview was already removed. */
        }
        release();
      });
    };
  }, [cameraTry, regionId]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <div id={regionId} className="meal-reader min-h-64 w-full overflow-hidden rounded-xl border border-border bg-black" />
          <div id={fileRegionId} className="hidden" />
          <p className="mt-2 text-sm text-muted-foreground">{camera}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setCameraTry((current) => current + 1)}>Try camera again</Button>
            <Label htmlFor="meal-photo" className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-sm">Scan a photo</Label>
            <input
              id="meal-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void (async () => {
                  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
                  const reader = new Html5Qrcode(fileRegionId, {
                    verbose: false,
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.EAN_13],
                  });
                  try {
                    const text = await reader.scanFile(file, false);
                    await sellRef.current(text);
                  } catch {
                    setError("That photo did not contain a meal QR or barcode.");
                  } finally {
                    reader.clear();
                  }
                })();
              }}
            />
          </div>
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
