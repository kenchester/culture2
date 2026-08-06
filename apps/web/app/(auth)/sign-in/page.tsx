import Link from "next/link";
import { signIn } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to your diaspora network."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {reset && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          Password updated. Sign in with your new password.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <form action={signIn} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </Field>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
      <Link href="/reset-password" className="text-center text-sm text-muted hover:text-primary">
        Forgot your password?
      </Link>
    </AuthCard>
  );
}
