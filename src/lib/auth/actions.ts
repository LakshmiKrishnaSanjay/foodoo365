"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { investors } from "@/lib/demo/catalog";
import { staffByEmail } from "@/lib/demo/staff";
import { open, seal } from "@/lib/auth/crypto";
import {
  clearSession,
  getSession,
  passwordMatches,
  readIds,
  savePassword,
  saveProfile,
  saveReads,
  saveSession,
} from "@/lib/auth/session";
import { isSupabaseMode } from "@/lib/supabase/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorld } from "@/lib/demo/world";

const credentials = z.object({
  email: z.email("Enter the email on your investor profile."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.string().trim().min(7, "Enter a phone number.").max(30),
  city: z.string().trim().min(2, "Enter a city.").max(60),
  emailAlerts: z.boolean(),
  payoutAlerts: z.boolean(),
  statementAlerts: z.boolean(),
});

export async function loginAction(input: { email: string; password: string }) {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Those credentials were not recognized." };
    redirect("/overview");
  }

  const investor = investors.find((item) => item.email.toLowerCase() === parsed.data.email.toLowerCase());
  if (investor && (await passwordMatches(investor.email, parsed.data.password))) {
    await saveSession(investor.id, "investor");
    redirect("/overview");
  }
  const member = staffByEmail(parsed.data.email);
  if (member && (await passwordMatches(member.email, parsed.data.password))) {
    await saveSession(member.id, member.role);
    redirect(member.role === "seller" ? "/sell" : "/admin");
  }
  return { error: "Those demo credentials were not recognized." };
}

export async function continueAsGuestAction() {
  if (isSupabaseMode()) redirect("/login");
  await saveSession(investors[0].id, "investor");
  redirect("/overview");
}

export async function switchDemoInvestorAction(investorId: string) {
  if (isSupabaseMode()) return;
  const investor = investors.find((item) => item.id === investorId);
  if (!investor) return;
  await saveSession(investor.id, "investor");
  revalidatePath("/", "layout");
}

export async function logoutAction() {
  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  await clearSession();
}

export async function requestResetAction(input: { email: string }) {
  const email = z.email().safeParse(input.email);
  if (!email.success) return { error: "Enter a valid email address." };

  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    const envUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${envUrl}/update-password`,
    });
    if (error) return { error: "The reset email could not be requested." };
    return { message: "If an account exists, a reset email has been sent." };
  }

  const investor = investors.find((item) => item.email.toLowerCase() === email.data.toLowerCase());
  if (!investor) return { error: "No demonstration investor uses that email." };
  const token = seal({ purpose: "reset", email: investor.email, exp: Date.now() + 1000 * 60 * 30 });
  return {
    message: "Demonstration mode does not send email. Use the reset link below. It expires in 30 minutes.",
    href: `/update-password?token=${encodeURIComponent(token)}`,
  };
}

export async function updatePasswordAction(input: { token: string; password: string }) {
  const password = z.string().min(8, "Use at least 8 characters.").safeParse(input.password);
  if (!password.success) return { error: password.error.issues[0]?.message ?? "Choose a longer password." };

  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: password.data });
    if (error) return { error: "The password could not be updated. Request a new reset link." };
    redirect("/overview");
  }

  const token = open<{ purpose: "reset"; exp: number; email: string }>(input.token, "reset");
  if (!token?.email) return { error: "This reset link is invalid or has expired." };
  await savePassword(token.email, password.data);
  redirect("/login?reset=1");
}

export async function updateProfileAction(input: z.infer<typeof profileSchema>) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const session = await getSession();
  if (!session) return { error: "Your session has ended." };

  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        preferred_name: parsed.data.fullName.split(" ")[0],
        phone: parsed.data.phone,
        city: parsed.data.city,
        email_alerts: parsed.data.emailAlerts,
        payout_alerts: parsed.data.payoutAlerts,
        statement_alerts: parsed.data.statementAlerts,
      })
      .eq("id", session.id);
    if (error) return { error: "Your profile could not be saved." };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  await saveProfile({ purpose: "profile", exp: Date.now() + 1000 * 60 * 60 * 24 * 60, ...parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(input: { current: string; next: string }) {
  const session = await getSession();
  if (!session) return { error: "Your session has ended." };
  const next = z.string().min(8, "Use at least 8 characters.").safeParse(input.next);
  if (!next.success) return { error: next.error.issues[0]?.message ?? "Choose a longer password." };
  if (!(await passwordMatches(session.email, input.current))) return { error: "The current password is incorrect." };

  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: next.data });
    if (error) return { error: "The password could not be updated." };
    return { ok: true };
  }

  await savePassword(session.email, next.data);
  return { ok: true };
}

export async function markNotificationReadAction(id: string) {
  const session = await getSession();
  if (!session) return;
  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("notifications").update({ unread: false }).eq("id", id).eq("investor_id", session.id);
    revalidatePath("/", "layout");
    return;
  }
  const allowed = new Set(getWorld().notifications.filter((item) => item.investorId === session.id).map((item) => item.id));
  if (!allowed.has(id)) return;
  const ids = new Set(await readIds());
  ids.add(id);
  await saveReads([...ids]);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await getSession();
  if (!session) return;
  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("notifications").update({ unread: false }).eq("investor_id", session.id).eq("unread", true);
    revalidatePath("/", "layout");
    return;
  }
  const ids = getWorld()
    .notifications.filter((item) => item.investorId === session.id)
    .map((item) => item.id);
  await saveReads(ids);
  revalidatePath("/", "layout");
}
