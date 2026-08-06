import Link from "next/link";
import { signIn } from "@/app/(auth)/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {reset && (
        <p className="text-sm text-green-700">
          Password updated. Sign in with your new password.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={signIn} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Sign in
        </button>
      </form>
      <Link href="/reset-password" className="text-sm text-zinc-600 underline">
        Forgot your password?
      </Link>
    </div>
  );
}
