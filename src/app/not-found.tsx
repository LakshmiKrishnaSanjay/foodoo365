import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-heading text-3xl">This page is not available</h1>
      <p className="text-sm leading-6 text-muted-foreground">The record may belong to another investor, or the link is no longer valid.</p>
      <Button asChild><Link href="/overview">Back to overview</Link></Button>
    </main>
  );
}
