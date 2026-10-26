import { Suspense } from "react";
import { PageIntro, PageSkeleton } from "@/components/portal/bits";
import { SettingsForms } from "@/components/settings/settings-forms";
import { readRequest } from "@/lib/portal-request";

export const metadata = { title: "Profile & Settings" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageSkeleton />}><SettingsPage searchParams={props.searchParams} /></Suspense>;
}

async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session } = await readRequest(searchParams);
  return (
    <div className="space-y-6">
      <PageIntro title="Profile and settings" description="Your session is limited to the trucks and agreements assigned to this investor. Other investors' records are not available from this account." />
      <SettingsForms user={session} />
    </div>
  );
}
