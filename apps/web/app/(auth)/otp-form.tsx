"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  checkEmailStatus,
  sendOtp,
  setDisplayName,
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
// password path; everyone else goes straight to a code. The name field on
// the first screen only ever applies to a brand-new account - typing
// something there for an email that turns out to already exist is silently
// ignored, so an existing user's real name can never get clobbered by a
// stray autofill or habit of always filling it in. A single "Name" field
// rather than split first/last, since a first/last split assumes a naming
// order that doesn't hold for everyone (e.g. East Asian family-name-first
// conventions). Runs entirely through direct server-action calls (no <form
// action> redirects) so it never leaves the page it's rendered on -
// critical for embeds, where a real navigation would either break out of
// the iframe or swap it to a page that doesn't match the embed's look.
export function OtpForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password" | "code" | "bridge">("email");
  const [email, setEmail] = useState("");
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // A successful verify/sign-in only means the server accepted the
  // credentials and tried to set a session cookie - inside a third-party
  // iframe (most often Safari) the browser can silently refuse to store it.
  // Checking our own browser client's session is the only reliable way to
  // tell the two apart, since the server-side result looks identical either
  // way. beforeNavigate runs only once a session is confirmed to exist, so
  // callers can do authenticated follow-up work (like saving a name) before
  // the page moves on.
  async function trySettle(beforeNavigate?: () => Promise<void>): Promise<boolean> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    if (beforeNavigate) await beforeNavigate();
    router.push(returnTo ?? "/");
    router.refresh();
    return true;
  }

  async function applyPendingName() {
    if (!pendingName) return;
    const formData = new FormData();
    formData.set("name", pendingName);
    await setDisplayName(formData);
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
    const submittedName = ((formData.get("name") as string) || "").trim();
    setError(null);
    setIsPending(true);
    void tryRequestStorageAccess();
    try {
      const { exists, hasPassword } = await checkEmailStatus(formData);
      setEmail(submittedEmail);
      if (hasPassword) {
        setStep("password");
        return;
      }
      setPendingName(!exists && submittedName ? submittedName : null);
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
      if (!(await trySettle(applyPendingName))) {
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
    const settled = await trySettle(applyPendingName);
    setIsPending(false);
    if (!settled) {
      setError(t("bridge.stillBlocked"));
    }
  }

  if (step === "bridge") {
    const isEmbedded = typeof window !== "undefined" && window.self !== window.top;
    const bridgeHref = `/sign-in?returnTo=${encodeURIComponent(stripEmbedParam(returnTo ?? "/"))}`;

    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-body">{t("bridge.explanation")}</p>
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
              {t("bridge.continueNewTab")}
            </a>
            <button
              type="button"
              onClick={handleBridgeRetry}
              disabled={isPending}
              className="text-center text-sm text-muted underline hover:text-primary"
            >
              {isPending ? t("bridge.checking") : t("bridge.continueHere")}
            </button>
          </>
        ) : (
          <Button type="button" onClick={handleBridgeRetry} disabled={isPending}>
            {isPending ? t("bridge.checking") : t("bridge.tryAgain")}
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
          {t.rich("password.signingInAs", {
            email,
            b: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
          })}
        </p>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <Field>
          <Label htmlFor="password">{t("password.label")}</Label>
          <Input id="password" name="password" type="password" required autoFocus />
        </Field>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? t("password.signingIn") : t("password.submit")}
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
          {t("password.emailCode")}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("email");
          }}
          className="text-center text-sm text-muted underline hover:text-primary"
        >
          {t("password.useDifferentEmail")}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form action={handleVerify} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <p className="text-center text-sm text-body">
          {t.rich("code.weEmailedCode", {
            email,
            b: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
          })}
        </p>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <Field>
          <Label htmlFor="token">{t("code.label")}</Label>
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
          {isPending ? t("code.verifying") : t("code.submit")}
        </Button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setPendingName(null);
            setStep("email");
          }}
          className="text-center text-sm text-muted underline hover:text-primary"
        >
          {t("code.useDifferentEmail")}
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
        <Label htmlFor="email">{t("email.label")}</Label>
        <Input id="email" name="email" type="email" required autoFocus />
      </Field>
      <Field>
        <Label htmlFor="name">{t("email.nameLabel")}</Label>
        <Input id="name" name="name" placeholder={t("email.namePlaceholder")} />
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("email.continuing") : t("email.submit")}
      </Button>
    </form>
  );
}
