"use client";

import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function DeskFrame({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
        <div>
          <p className="font-heading text-xl">Foodoo365</p>
          <p className="text-sm text-muted-foreground">{name} · {role}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/menu">Customer menu</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void logoutAction().then(() => {
                window.location.assign("/login");
              });
            }}
          >
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
