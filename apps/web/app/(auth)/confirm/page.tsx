import { confirmEmail } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; error?: string; returnTo?: string; embed?: string }>;
}) {
  const { token_hash, error, returnTo, embed } = await searchParams;

  if (!token_hash) {
    return (
      <AuthCard title="Check your email">
        <p className="text-center text-sm text-body">
          We sent you a confirmation link. Click it to finish signing up.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm your email">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <form action={confirmEmail}>
        <input type="hidden" name="token_hash" value={token_hash} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        {embed === "1" && <input type="hidden" name="embed" value="1" />}
        <Button type="submit" className="w-full">
          Confirm email address
        </Button>
      </form>
    </AuthCard>
  );
}
