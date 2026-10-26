"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { recordSaleAction } from "@/lib/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaleBoard } from "@/components/desk/sale-board";

function cameraFailure(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  if (/notallowed|permission|denied|not supported|insecure/i.test(text)) {
    return "The phone blocked the camera. Tap Open camera and choose Allow. If you already blocked it, tap the lock icon in the address bar and allow Camera.";
  }
  if (/could not start|notreadable|busy|abort/i.test(text)) {
    return "The camera is busy. Close other apps that are using it, then tap Open camera.";
  }
  if (/notfound|requested device|no camera/i.test(text)) {
    return "This browser did not offer a camera. Open the page in Chrome or Safari, or tap Scan a photo.";
  }
  return "The camera did not start. Tap Open camera and allow access, or tap Scan a photo.";
}

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
  const [camera, setCamera] = useState("Tap Open camera. The phone asks for permission, and the preview stays black until you allow it.");
  const [last, setLast] = useState<{ saleNumber: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quantityRef = useRef(1);
  const lastScan = useRef({ code: "", at: 0 });
  const recording = useRef(false);
  const opening = useRef(false);
  const scannerRef = useRef<{ isScanning: boolean; stop: () => Promise<void>; clear: () => void } | null>(null);
  const regionId = `meal-reader-${useId().replace(/:/g, "")}`;
  const fileRegionId = `${regionId}-file`;

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  const sellRef = useRef<(raw: string) => Promise<void>>(async () => undefined);
  const scanGate = useRef({ ready: true, misses: 0 });

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
    sellRef.current = sell;
  });

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner?.isScanning) return;
      void scanner.stop().catch(() => undefined).finally(() => {
        try {
          scanner.clear();
        } catch {
          /* The preview was already removed. */
        }
      });
    };
  }, []);

  function openCamera() {
    if (!window.isSecureContext) {
      setCamera("The camera needs https. Open https://foodoo365.vercel.app/sell in Chrome or Safari.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("This browser has no camera access. Open the page in Chrome or Safari, or tap Scan a photo.");
      return;
    }
    if (opening.current) return;
    opening.current = true;
    setCamera("Allow the camera in the prompt.");
    setError(null);
    const permission = navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    void (async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await permission;
        stream.getTracks().forEach((track) => track.stop());
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (scannerRef.current?.isScanning) await scannerRef.current.stop().catch(() => undefined);
        const instance = new Html5Qrcode(regionId, {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        });
        scannerRef.current = instance;
        const attempts: MediaTrackConstraints[] = [{ facingMode: "environment" }, { facingMode: "user" }];
        let lastError: unknown = null;
        for (const cameraConfig of attempts) {
          try {
            await instance.start(
              cameraConfig,
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
            setCamera("Point the camera at the meal QR or barcode.");
            return;
          } catch (error) {
            lastError = error;
            if (instance.isScanning) await instance.stop().catch(() => undefined);
          }
        }
        setCamera(cameraFailure(lastError));
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        setCamera(cameraFailure(error));
      } finally {
        opening.current = false;
      }
    })();
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <div id={regionId} className="meal-reader min-h-64 w-full overflow-hidden rounded-xl border border-border bg-black" />
          <div id={fileRegionId} className="hidden" />
          <p className="mt-2 text-sm text-muted-foreground">{camera}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" onClick={openCamera}>Open camera</Button>
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
              <Input id="meal-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="FD1|A|prod-porotta" className="h-10 font-mono" />
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
