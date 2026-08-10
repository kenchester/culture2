"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkHasPassword,
  sendOtp,
  signInWithPassword,
  verifyOtp,
} from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

// The sanctioned way to ask Safari (and any other browser with strict
// third-party cookie blocking) for an exception, before a session cookie
// response gets silently dropped inside a cross-site iframe. Must be called
// synchronously in response to a real click - a grant applies for the rest
// of the page's life, not just the request that follows it, so calling this
// on every click in the flow maximizes the chance it's in place by the time
// we actually need it. It's a safe no-op in browsers that don't need it.
async function tryRequestStorageAccess() {
  if (typeof document === "undefined" || !("requestStorageAccess" in document)) return;
  try {
    await document.requestStorageAccess();
  } catch {
    // Denied or unsupported - the post-verify session check is what
    // actually decides whether we need the fallback, not this attempt.
  }
}

function stripEmbedParam(path: string): string {
  try {
    const url = new URL(path, "http://placeholder.invalid");
    url.searchParams.delete("embed");
    return `${url.pathname}${url.search}`;
  } catch {
    return path;
  }
}

// Returning users who already set a password get offered the faster
// password path; anyone else (the common case for new embed registrations)
// goes straight to an emailed code. Either path can fall back to the other -
// "use a code instead" if a password's forgotten, no separate reset flow
// needed. Runs entirely through direct server-action calls (no <form
// action> redirects) so it never leaves the page it's rendered on - critical
// for embeds, where a real navigation would either break out of the iframe
// or swap it to a page that doesn't match the embed's look.
export function OtpForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password" | "code" | "bridge">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // A successful verify/sign-in only means the server accepted the
  // credentials and tried to set a session cookie - inside a third-party
  // iframe (most often Safari) the browser can silently refuse to store it.
  // Checking our own browser client's session is the only reliable way to
  // tell the two apart, since the server-side result looks identical either
  // way.
  async function trySettle(): Promise<boolean> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    router.push(returnTo ?? "/");
    router.refresh();
    return true;
  }

  async function sendCode(targetEmail: string) {
    const formData = new FormData();
    formData.set("email", targetEmail);
    const result = await sendOtp(formData);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStep("code");
  }

  async function handleContinue(formData: FormData) {
    const submittedEmail = formData.get("email") as string;
    setError(null);
    setIsPending(true);
    void tryRequestStorageAccess();
    try {
      const { hasPassword } = await checkHasPassword(formData);
      setEmail(submittedEmail);
      if (hasPassword) {
        setStep("password");
        return;
      }
      await sendCode(submittedEmail);
    } finally {
      setIsPending(false);
    }
  }

  async function handlePasswordSignIn(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      await tryRequestStorageAccess();
      const result = await signInWithPassword(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (!(await trySettle())) {
        setStep("bridge");
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerify(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      await tryRequestStorageAccess();
      const result = await verifyOtp(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (!(await trySettle())) {
        setStep("bridge");
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleBridgeRetry() {
    setError(null);
    setIsPending(true);
    await tryRequestStorageAccess();
    const settled = await trySettle();
    setIsPending(false);
    if (!settled) {
      setError("Still not able to stay signed in inside this window.");
    }
  }

  if (step === "bridge") {
    const isEmbedded = typeof window !== "undefined" && window.self !== window.top;
    const bridgeHref = `/sign-in?returnTo=${encodeURIComponent(stripEmbedParam(returnTo ?? "/"))}`;

    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-body">
          You&apos;re verified, but this browser is blocking sign-in inside an embedded window.
        </p>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        {isEmbedded ? (
          <>
            <a
              href={bridgeHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-primary px-3 py-2 text-center font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Continue in a new tab
            </a>
            <button
              type="button"
              onClick={handleBridgeRetry}
              disabled={isPending}
              className="text-center text-sm text-muted underline hover:text-primary"
            >
              {isPending ? "Checking…" : "I finished in the new tab — continue here"}
            </button>
          </>
        ) : (
          <Button type="button" onClick={handleBridgeRetry} disabled={isPending}>
            {isPending ? "Checking…" : "Try again"}
          </Button>
        )}
      </div>
    );
  }

  if (step === "password") {
    return (
      <form action={handlePasswordSignIn} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <p className="text-center text-sm text-body">
          Signing in as <span className="font-medium text-ink">{email}</span>.
        </p>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <Field>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoFocus />
        </Field>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsPending(true);
            sendCode(email).finally(() => setIsPending(false));
          }}
          disabled={isPending}
          className="text-center text-sm text-muted underline hover:text-primary"
        >
          Email me a code instead
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("email");
          }}
          className="text-center text-sm text-muted underline hover:text-primary"
        >
          Use a different email
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form action={handleVerify} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <p className="text-center text-sm text-body">
          We emailed a code to <span className="font-medium text-ink">{email}</span>.
        </p>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <Field>
          <Label htmlFor="token">Code</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Verifying…" : "Verify and continue"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("email");
          }}
          className="text-center text-sm text-muted underline hover:text-primary"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form action={handleContinue} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus />
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Continuing…" : "Continue"}
      </Button>
    </form>
  );
}
