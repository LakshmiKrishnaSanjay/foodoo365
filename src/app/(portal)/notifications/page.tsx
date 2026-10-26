import Link from "next/link";
import { Suspense } from "react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/auth/actions";
import { EmptyState, PageIntro, PageSkeleton, StatusPill } from "@/components/portal/bits";
import { Button } from "@/components/ui/button";
import { getNotifications, preservedQuery } from "@/lib/data/queries";
import { readIds } from "@/lib/auth/session";
import { readRequest } from "@/lib/portal-request";
import { cn } from "cn";

export const metadata = { title: "Notifications" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><NotificationsPage searchParams={props.searchParams} /></Suspense>;
}

async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, filters } = await readRequest(searchParams);
  const data = await getNotifications(session.id, filters, await readIds());
  if (!data) return null;
  return (
    <div className="space-y-6">
      <PageIntro title="Notifications" description="Payouts, statements, truck operations and charity activity for your account." actions={
        <form action={markAllNotificationsReadAction}><Button type="submit" variant="outline" className="h-10">Mark all read</Button></form>
      } />
      <div className="flex gap-2">
        <Link href={`/notifications${preservedQuery(filters, { notice: "all" })}`} className={cn("rounded-lg px-3 py-2 text-sm", filters.notice === "all" ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-foreground/10")}>All</Link>
        <Link href={`/notifications${preservedQuery(filters, { notice: "unread" })}`} className={cn("rounded-lg px-3 py-2 text-sm", filters.notice === "unread" ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-foreground/10")}>Unread</Link>
      </div>
      {data.items.length === 0 ? <EmptyState title="No notifications" body={filters.notice === "unread" ? "You have no unread notifications." : "Nothing has been posted to your account."} /> : (
        <ul className="space-y-3">
          {data.items.map((item) => (
            <li key={item.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{item.title}</h2>
                    {item.unread && <StatusPill status="unread" />}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.createdLabel} · {item.category}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm"><Link href={item.href}>Open</Link></Button>
                  {item.unread && (
                    <form action={markNotificationReadAction.bind(null, item.id)}>
                      <Button type="submit" size="sm">Mark read</Button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
