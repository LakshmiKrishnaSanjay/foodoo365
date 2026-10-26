"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requestResetAction, updatePasswordAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.object({ email: z.email("Enter a valid email address.") });
const passwordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
  confirm: z.string().min(8),
}).refine((value) => value.password === value.confirm, { path: ["confirm"], message: "Passwords do not match." });

export function ResetForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [href, setHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });

  return (
    <form
      className="w-full max-w-md space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        const result = await requestResetAction(values);
        if (result.error) setError(result.error);
        setMessage(result.message ?? null);
        setHref("href" in result ? result.href ?? null : null);
      })}
    >
      <div>
        <h1 className="font-heading text-4xl">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the email on a demonstration investor profile. This demo does not send email, so the reset link appears here.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" className="h-10" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p>}
      {href && <Button asChild className="h-10 w-full"><Link href={href}>Open reset link</Link></Button>}
      <Button type="submit" variant="outline" className="h-10 w-full">Request reset link</Button>
      <Link href="/login" className="block text-sm text-primary underline-offset-4 hover:underline">Back to sign in</Link>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { password: "", confirm: "" } });
  return (
    <form
      className="w-full max-w-md space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await updatePasswordAction({ token, password: values.password });
        if (result?.error) setError(result.error);
      })}
    >
      <div>
        <h1 className="font-heading text-4xl">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">In this demonstration, the new password is saved in this browser. The shared demo password still works on other browsers.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" className="h-10" {...form.register("password")} />
        {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" type="password" className="h-10" {...form.register("confirm")} />
        {form.formState.errors.confirm && <p className="text-sm text-destructive">{form.formState.errors.confirm.message}</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-10 w-full" disabled={!token || form.formState.isSubmitting}>Update password</Button>
    </form>
  );
}
