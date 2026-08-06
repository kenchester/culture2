import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  updatePassword,
} from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; token_hash?: string }>;
}) {
  const { error, sent, token_hash } = await searchParams;

  if (token_hash) {
    return (
      <AuthCard title="Set a new password">
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <form action={resetPasswordWithToken} className="flex flex-col gap-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <Field>
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </Field>
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </AuthCard>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <AuthCard title="Set a new password">
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <form action={updatePassword} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </Field>
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to get back in."
      footer={
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          Check your email for a reset link.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
