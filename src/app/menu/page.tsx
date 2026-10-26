import { Suspense } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { menuCards } from "@/lib/demo/live-sales";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading the menu…</div>}>
      <MenuPage />
    </Suspense>
  );
}

async function MenuPage() {
  const trucks = await Promise.all(
    menuCards().map(async (truck) => ({
      ...truck,
      meals: await Promise.all(
        truck.meals.map(async (meal) => ({
          ...meal,
          image: await QRCode.toDataURL(meal.code, { margin: 1, width: 220, errorCorrectionLevel: "M" }),
        })),
      ),
    })),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-8">
        <div>
          <p className="font-heading text-2xl">Foodoo365 menu</p>
          <p className="text-sm text-muted-foreground">Show a meal QR to the person in the truck. They scan it and the sale gets a number.</p>
        </div>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">Staff sign in</Link>
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-8">
        {trucks.map((truck) => (
          <section key={truck.code} className="space-y-4">
            <div>
              <p className="text-xs tracking-[0.16em] text-gold uppercase">Truck {truck.code}</p>
              <h2 className="font-heading text-3xl">{truck.name}</h2>
              <p className="text-sm text-muted-foreground">{truck.location}{truck.status === "maintenance" ? " · service in progress, a demo sale can still be scanned" : ""}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {truck.meals.map((meal) => (
                <article key={meal.code} className="rounded-xl border border-border bg-card p-4">
                  <img src={meal.image} alt={`QR code for ${meal.name} at ${truck.name}`} className="mx-auto size-44" />
                  <h3 className="mt-3 font-medium">{meal.name}</h3>
                  <p className="text-sm text-muted-foreground">{meal.price}</p>
                  <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{meal.code}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
