import { cookies } from "next/headers";
import { connection } from "next/server";
import { DEMO_PASSWORD, investors } from "@/lib/demo/catalog";
import { staffById, type AccountRole } from "@/lib/demo/staff";
import { checkPassword, cookieBase, hashPassword, open, seal } from "@/lib/auth/crypto";
import { isSupabaseMode } from "@/lib/supabase/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionProfile {
  id: string;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  city: string;
  joinedOn: string;
  emailAlerts: boolean;
  payoutAlerts: boolean;
  statementAlerts: boolean;
  role: AccountRole;
  truckId: string | null;
}

interface ProfilePayload {
  purpose: "profile";
  exp: number;
  fullName?: string;
  phone?: string;
  city?: string;
  emailAlerts?: boolean;
  payoutAlerts?: boolean;
  statementAlerts?: boolean;
}

interface ReadPayload {
  purpose: "reads";
  exp: number;
  ids: string[];
}

interface PasswordPayload {
  purpose: "password";
  exp: number;
  email: string;
  hash: string;
}

function profileFromInvestor(id: string): Omit<SessionProfile, "emailAlerts" | "payoutAlerts" | "statementAlerts" | "role" | "truckId"> | null {
  const investor = investors.find((item) => item.id === id);
  if (!investor) return null;
  return {
    id: investor.id,
    fullName: investor.fullName,
    preferredName: investor.preferredName,
    email: investor.email,
    phone: investor.phone,
    city: investor.city,
    joinedOn: investor.joinedOn,
  };
}

export async function getSession(): Promise<SessionProfile | null> {
  if (isSupabaseMode()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    if (!profile) return null;
    return {
      id: profile.id,
      fullName: profile.full_name,
      preferredName: profile.preferred_name,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      joinedOn: profile.joined_on,
      emailAlerts: profile.email_alerts,
      payoutAlerts: profile.payout_alerts,
      statementAlerts: profile.statement_alerts,
      role: "investor",
      truckId: null,
    };
  }

  const jar = await cookies();
  await connection();
  const session = open<{ purpose: "session"; exp: number; sub: string; role?: AccountRole }>(jar.get("foodoo_session")?.value, "session");
  if (!session?.sub) return investorSession(investors[0].id, null);
  const member = staffById(session.sub);
  if (member) {
    return {
      id: member.id,
      fullName: member.fullName,
      preferredName: member.preferredName,
      email: member.email,
      phone: "",
      city: member.city,
      joinedOn: "2026-05-01",
      emailAlerts: false,
      payoutAlerts: false,
      statementAlerts: false,
      role: member.role,
      truckId: member.truckId,
    };
  }
  const override = open<ProfilePayload>(jar.get("foodoo_profile")?.value, "profile");
  return investorSession(session.sub, override);
}

function investorSession(id: string, override: ProfilePayload | null): SessionProfile | null {
  const base = profileFromInvestor(id);
  if (!base) return null;
  return {
    ...base,
    fullName: override?.fullName || base.fullName,
    phone: override?.phone || base.phone,
    city: override?.city || base.city,
    preferredName: (override?.fullName || base.fullName).split(" ")[0] || base.preferredName,
    emailAlerts: override?.emailAlerts ?? true,
    payoutAlerts: override?.payoutAlerts ?? true,
    statementAlerts: override?.statementAlerts ?? true,
    role: "investor",
    truckId: null,
  };
}

export async function readIds(): Promise<string[]> {
  if (isSupabaseMode()) return [];
  const jar = await cookies();
  await connection();
  return open<ReadPayload>(jar.get("foodoo_reads")?.value, "reads")?.ids ?? [];
}

export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const jar = await cookies();
  await connection();
  const stored = open<PasswordPayload>(jar.get("foodoo_pw")?.value, "password");
  if (stored && stored.email.toLowerCase() === email.toLowerCase()) return checkPassword(password, stored.hash);
  return password === DEMO_PASSWORD;
}

export async function saveSession(accountId: string, role: AccountRole) {
  const jar = await cookies();
  jar.set(
    "foodoo_session",
    seal({ purpose: "session", sub: accountId, role, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }),
    { ...cookieBase, maxAge: 60 * 60 * 24 * 7 },
  );
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete("foodoo_session");
}

export async function savePassword(email: string, password: string) {
  const jar = await cookies();
  jar.set(
    "foodoo_pw",
    seal({ purpose: "password", email: email.toLowerCase(), hash: hashPassword(password), exp: Date.now() + 1000 * 60 * 60 * 24 * 60 }),
    { ...cookieBase, maxAge: 60 * 60 * 24 * 60 },
  );
}

export async function saveProfile(profile: ProfilePayload) {
  const jar = await cookies();
  jar.set("foodoo_profile", seal({ ...profile, purpose: "profile", exp: Date.now() + 1000 * 60 * 60 * 24 * 60 }), {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 60,
  });
}

export async function saveReads(ids: string[]) {
  const jar = await cookies();
  jar.set("foodoo_reads", seal({ purpose: "reads", ids, exp: Date.now() + 1000 * 60 * 60 * 24 * 60 }), {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 60,
  });
}

