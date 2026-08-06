import { confirmEmail } from "@/app/(auth)/actions";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; error?: string }>;
}) {
  const { token_hash, error } = await searchParams;

  if (!token_hash) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-2 px-4 text-center">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-zinc-600">
          We sent you a confirmation link. Click it to finish signing up.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-semibold">Confirm your email</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={confirmEmail}>
        <input type="hidden" name="token_hash" value={token_hash} />
        <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white">
          Confirm email address
        </button>
      </form>
    </div>
  );
}
