"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.email("Enter the email on the account."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const DEMOS = [
  { name: "Amina Al Hashimi", email: "amina@demo.foodoo365.com", detail: "Investor · trucks A and B" },
  { name: "James Okonkwo", email: "james@demo.foodoo365.com", detail: "Investor · trucks B and C" },
  { name: "Priya Nair", email: "priya@demo.foodoo365.com", detail: "Investor · trucks C and D" },
  { name: "Layla Hassan", email: "marina@demo.foodoo365.com", detail: "Seller · Marina Grill" },
  { name: "Omar Farooq", email: "beach@demo.foodoo365.com", detail: "Seller · Beachside Kitchen" },
  { name: "Noor Al Mansoori", email: "corniche@demo.foodoo365.com", detail: "Seller · Corniche Plates" },
  { name: "Ravi Menon", email: "majaz@demo.foodoo365.com", detail: "Seller · Majaz Meals" },
  { name: "Meera Shah", email: "admin@demo.foodoo365.com", detail: "Admin · every truck" },
  { name: "Samir Qureshi", email: "super@demo.foodoo365.com", detail: "Super admin · every sale number" },
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
        <p className="text-xs tracking-[0.16em] text-gold uppercase">Foodoo365 access</p>
        <h1 className="mt-2 font-heading text-4xl">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Investors, truck sellers, and admins use the same demonstration password, <span className="font-medium text-foreground">demo-investor</span>. Customers do not sign in.</p>
      </div>
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
