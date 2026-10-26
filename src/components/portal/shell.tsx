"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronLeft,
  FileText,
  HandHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Settings,
  Truck,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { logoutAction, switchDemoInvestorAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "cn";
import { DateFilter } from "@/components/portal/filters";
import { NotificationBell } from "@/components/portal/notification-bell";
import { ThemeToggle } from "@/components/portal/theme-toggle";
import type { BellNotice } from "@/lib/data/queries";
import type { SessionProfile } from "@/lib/auth/session";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/investments", label: "My Investments", icon: Wallet },
  { href: "/trucks", label: "My Food Trucks", icon: Truck },
  { href: "/sales", label: "Sales & Revenue", icon: BarChart3 },
  { href: "/inventory", label: "Inventory & Meals", icon: UtensilsCrossed },
  { href: "/profit", label: "Profit & Earnings", icon: PieChart },
  { href: "/charity", label: "Charity Impact", icon: HandHeart },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Profile & Settings", icon: Settings },
];

function NavLinks({ collapsed, unread, onNavigate }: { collapsed?: boolean; unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const preserved = new URLSearchParams();
  if (params.get("from")) preserved.set("from", params.get("from") ?? "");
  if (params.get("to")) preserved.set("to", params.get("to") ?? "");
  const query = preserved.toString();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={query ? `${item.href}?${query}` : item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.href === "/notifications" && unread > 0 && (
              <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 text-[11px] font-medium text-sidebar-primary-foreground">{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-0")}>
      <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-heading text-base text-sidebar-primary-foreground">F</span>
      {!collapsed && (
        <span>
          <span className="block font-heading text-base leading-none text-sidebar-foreground">Foodoo365</span>
          <span className="mt-1 block text-[11px] tracking-wide text-sidebar-foreground/60 uppercase">Investor portal</span>
        </span>
      )}
    </div>
  );
}

export function Shell({
  user,
  unread,
  notices,
  demoInvestors = [],
  children,
}: {
  user: SessionProfile;
  unread: number;
  notices: BellNotice[];
  demoInvestors?: Array<{ id: string; name: string; detail: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("foodoo-sidebar") === "collapsed");
  }, []);

  function toggle() {
    setCollapsed((current) => {
      window.localStorage.setItem("foodoo-sidebar", current ? "expanded" : "collapsed");
      return !current;
    });
  }

  const initials = user.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] lg:flex", collapsed ? "w-[76px]" : "w-64")}>
        <Brand collapsed={collapsed} />
        <Suspense fallback={null}>
          <NavLinks collapsed={collapsed} unread={unread} />
        </Suspense>
        <div className="p-3">
          <Button type="button" variant="ghost" className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={toggle}>
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>
      <div className={cn("min-h-screen transition-[padding]", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <Brand />
              <Suspense fallback={null}>
                <NavLinks unread={unread} onNavigate={() => setOpen(false)} />
              </Suspense>
            </SheetContent>
          </Sheet>
          <Suspense fallback={<div className="h-10 w-72 animate-pulse rounded-lg bg-muted" />}>
            <DateFilter />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell investorId={user.id} notices={notices} unread={unread} />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 px-2">
                  <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{initials}</span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm leading-none">{user.preferredName}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{user.city}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block">{user.fullName}</span>
                  <span className="block font-normal text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Profile & settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications">Notifications{unread > 0 ? ` (${unread})` : ""}</Link>
                </DropdownMenuItem>
                {demoInvestors.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Demo investors</DropdownMenuLabel>
                    {demoInvestors.map((investor) => (
                      <DropdownMenuItem
                        key={investor.id}
                        onSelect={(event) => {
                          event.preventDefault();
                          void switchDemoInvestorAction(investor.id).then(() => {
                            router.refresh();
                          });
                        }}
                      >
                        <span className="flex flex-col">
                          <span>{investor.name}{investor.id === user.id ? " · viewing" : ""}</span>
                          <span className="text-xs text-muted-foreground">{investor.detail}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    void logoutAction().then(() => {
                      window.location.assign("/login");
                    });
                  }}
                >
                  <LogOut className="size-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="no-print border-b border-gold/30 bg-gold/10 px-4 py-2 text-sm text-foreground md:px-8">
          Demonstration data. These figures are simulated for the investor portal and are not Foodoo365&apos;s actual performance.
        </div>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
