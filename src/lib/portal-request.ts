import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { filterChoices, parseFilters, type Filters } from "@/lib/data/queries";
import type { SessionProfile } from "@/lib/auth/session";

export async function readRequest(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const session = await getSession();
  if (!session) redirect("/login");
  const filters = parseFilters(await searchParams);
  const choices = await filterChoices(session.id);
  return { session, filters, choices };
}

export type PortalRequest = {
  session: SessionProfile;
  filters: Filters;
  choices: Awaited<ReturnType<typeof filterChoices>>;
};
