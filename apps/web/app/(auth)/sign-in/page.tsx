import Link from "next/link";
import { signIn } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; returnTo?: string; embed?: string }>;
}) {
  const { error, reset, returnTo, embed } = await searchParams;
  const signUpParams = new URLSearchParams();
  if (returnTo) signUpParams.set("returnTo", returnTo);
  if (embed === "1") signUpParams.set("embed", "1");
  const signUpQuery = signUpParams.toString();
  const signUpHref = signUpQuery ? `/sign-up?${signUpQuery}` : "/sign-up";

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to your diaspora network."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={signUpHref} className="font-medium text-primary hover:underline">
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
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        {embed === "1" && <input type="hidden" name="embed" value="1" />}
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
