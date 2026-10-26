"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/supabase/mode";

export function createSupabaseBrowserClient() {
  const env = supabasePublicEnv();
  if (!env) throw new Error("Supabase public environment is not configured.");
  return createBrowserClient(env.url, env.anonKey);
}
