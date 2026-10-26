import { Suspense } from "react";
import { NewPasswordForm } from "@/components/auth/reset-forms";

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense>
      <ResetPage searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <NewPasswordForm token={token} />
    </main>
  );
}
