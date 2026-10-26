"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { continueAsGuestAction, loginAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.email("Enter the email on the account."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const DEMOS = [
  { name: "Anjali Menon", email: "anjali@demo.foodoo365.com", detail: "Investor · trucks A and B" },
  { name: "Thomas Kurian", email: "thomas@demo.foodoo365.com", detail: "Investor · trucks B and C" },
  { name: "Fathima Rahman", email: "fathima@demo.foodoo365.com", detail: "Investor · trucks C and D" },
  { name: "Arjun Nair", email: "arjun@demo.foodoo365.com", detail: "Seller · Marina Grill" },
  { name: "Shabeer Ali", email: "shabeer@demo.foodoo365.com", detail: "Seller · Beachside Kitchen" },
  { name: "Lakshmi Pillai", email: "lakshmi@demo.foodoo365.com", detail: "Seller · Shanghumugham Plates" },
  { name: "Joseph Varghese", email: "joseph@demo.foodoo365.com", detail: "Seller · Fort Kochi Meals" },
  { name: "Meera Krishnan", email: "meera@demo.foodoo365.com", detail: "Admin · every truck" },
  { name: "Suresh Kumar", email: "suresh@demo.foodoo365.com", detail: "Super admin · every sale number" },
];

export function LoginForm({ reset }: { reset?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  return (
    <form
      className="w-full max-w-md space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        const result = await loginAction(values);
        if (result?.error) setError(result.error);
      })}
    >
      <div>
        <p className="text-xs tracking-[0.16em] text-gold uppercase">Guest access</p>
        <h1 className="mt-2 font-heading text-4xl">Welcome</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Look around the investor portal as a guest. The figures are demonstration data. Sign in only if you want a specific investor, seller, or admin.</p>
      </div>
      <Button type="button" className="h-10 w-full" onClick={() => void continueAsGuestAction()}>Continue as guest</Button>
      <p className="text-center text-xs tracking-wide text-muted-foreground uppercase">or sign in</p>
      {reset && <p className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">Password updated for this browser. Sign in with the new password.</p>}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="username" className="h-10" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/reset-password" className="text-sm text-primary underline-offset-4 hover:underline">Forgot password</Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" className="h-10" {...form.register("password")} />
        {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-10 w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Signing in" : "Sign in"}</Button>
      <p className="text-center text-sm">
        <Link href="/menu" className="text-primary underline-offset-4 hover:underline">Open the customer menu</Link>
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Demo accounts</p>
        {DEMOS.map((demo) => (
          <button
            key={demo.email}
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              form.setValue("email", demo.email);
              form.setValue("password", "demo-investor");
              void form.handleSubmit(async (values) => {
                const result = await loginAction(values);
                if (result?.error) setError(result.error);
              })();
            }}
          >
            <span>
              <span className="block font-medium">{demo.name}</span>
              <span className="text-muted-foreground">{demo.detail}</span>
            </span>
            <span className="text-primary">Enter</span>
          </button>
        ))}
      </div>
    </form>
  );
}
