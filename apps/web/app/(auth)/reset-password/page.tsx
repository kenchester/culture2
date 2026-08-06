import { createClient } from "@/lib/supabase/server";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  updatePassword,
} from "@/app/(auth)/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; token_hash?: string }>;
}) {
  const { error, sent, token_hash } = await searchParams;

  if (token_hash) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form action={resetPasswordWithToken} className="flex flex-col gap-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            minLength={6}
            className="rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            Update password
          </button>
        </form>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form action={updatePassword} className="flex flex-col gap-4">
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            minLength={6}
            className="rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            Update password
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {sent && (
        <p className="text-sm text-green-700">
          Check your email for a reset link.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Send reset link
        </button>
      </form>
    </div>
  );
}
