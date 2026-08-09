import Link from "next/link";
import { signUp } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string; embed?: string }>;
}) {
  const { error, returnTo, embed } = await searchParams;
  const signInParams = new URLSearchParams();
  if (returnTo) signInParams.set("returnTo", returnTo);
  if (embed === "1") signInParams.set("embed", "1");
  const signInQuery = signInParams.toString();
  const signInHref = signInQuery ? `/sign-in?${signInQuery}` : "/sign-in";

  return (
    <AuthCard
      title="Create your account"
      subtitle="Find your people, wherever you are."
      footer={
        <>
          Already have an account?{" "}
          <Link href={signInHref} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <form action={signUp} className="flex flex-col gap-4">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        {embed === "1" && <input type="hidden" name="embed" value="1" />}
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={6} />
        </Field>
        <Button type="submit" className="w-full">
          Sign up
        </Button>
      </form>
    </AuthCard>
  );
}
