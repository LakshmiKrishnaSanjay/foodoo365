"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { changePasswordAction, updateProfileAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SessionProfile } from "@/lib/auth/session";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name."),
  phone: z.string().trim().min(7, "Enter a phone number."),
  city: z.string().trim().min(2, "Enter a city."),
  emailAlerts: z.boolean(),
  payoutAlerts: z.boolean(),
  statementAlerts: z.boolean(),
});

const passwordSchema = z.object({
  current: z.string().min(8, "Enter your current password."),
  next: z.string().min(8, "Use at least 8 characters."),
});

export function SettingsForms({ user }: { user: SessionProfile }) {
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const profile = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone,
      city: user.city,
      emailAlerts: user.emailAlerts,
      payoutAlerts: user.payoutAlerts,
      statementAlerts: user.statementAlerts,
    },
  });
  const password = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { current: "", next: "" } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
        onSubmit={profile.handleSubmit(async (values) => {
          setProfileError(null);
          const result = await updateProfileAction(values);
          if (result?.error) setProfileError(result.error);
          else toast.success("Profile saved on this browser.");
        })}
      >
        <div>
          <h2 className="font-heading text-2xl">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Email stays tied to the investor account. Other details are saved for this demonstration browser.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Name</Label>
          <Input id="fullName" className="h-10" {...profile.register("fullName")} />
          {profile.formState.errors.fullName && <p className="text-sm text-destructive">{profile.formState.errors.fullName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled className="h-10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" className="h-10" {...profile.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" className="h-10" {...profile.register("city")} />
          </div>
        </div>
        {user.pan ? (
          <div className="space-y-2">
            <Label htmlFor="pan">PAN</Label>
            <Input id="pan" value={user.pan} disabled className="h-10 font-mono" />
          </div>
        ) : null}
        {(["emailAlerts", "payoutAlerts", "statementAlerts"] as const).map((key) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">
            <span>{key === "emailAlerts" ? "Email alerts" : key === "payoutAlerts" ? "Payout alerts" : "Statement alerts"}</span>
            <Controller name={key} control={profile.control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </label>
        ))}
        {profileError && <p className="text-sm text-destructive">{profileError}</p>}
        <Button type="submit" className="h-10" disabled={profile.formState.isSubmitting}>Save profile</Button>
      </form>
      <form
        className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
        onSubmit={password.handleSubmit(async (values) => {
          setPasswordError(null);
          const result = await changePasswordAction(values);
          if (result?.error) setPasswordError(result.error);
          else {
            password.reset();
            toast.success("Password updated for this browser.");
          }
        })}
      >
        <div>
          <h2 className="font-heading text-2xl">Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">You can also reset a forgotten password from the sign-in page. The demo password remains available on browsers without a saved override.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input id="current" type="password" className="h-10" {...password.register("current")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">New password</Label>
          <Input id="next" type="password" className="h-10" {...password.register("next")} />
          {password.formState.errors.next && <p className="text-sm text-destructive">{password.formState.errors.next.message}</p>}
        </div>
        {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
        <Button type="submit" variant="outline" className="h-10">Update password</Button>
        <p className="text-xs leading-5 text-muted-foreground">Investor since {user.joinedOn}. Session is stored in a signed cookie and expires after seven days.</p>
      </form>
    </div>
  );
}
