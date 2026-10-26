"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { DeltaChip } from "@/components/portal/bits";
import type { Delta } from "@/lib/data/present";
import type { MoneyView } from "@/lib/money";

export function KpiGrid({
  items,
}: {
  items: Array<{ label: string; hint: string; amount?: MoneyView | null; count?: string; delta: Delta | null; tone?: "default" | "gold" | "positive" }>;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <motion.div key={item.label} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{item.label}</p>
              <p className={`font-heading text-2xl tabular-nums ${item.tone === "gold" ? "text-gold" : item.tone === "positive" ? "text-positive" : "text-foreground"}`}>
                {item.amount ? item.amount.formatted : item.count}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">{item.hint}</p>
              <DeltaChip delta={item.delta} />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
