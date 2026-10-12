import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/join/[token]/actions";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";

// A referral link is handed over in person, printed, or read aloud - it is
// not something to be indexed or previewed. noindex and no shareMetadata:
// a link preview naming a resettlement agency, generated wherever the link
// gets pasted, is a disclosure in itself.
export const metadata: Metadata = {
  title: "Join a community — CultureMesh",
  robots: { index: false, follow: false },
};

type Preview = {
  institution_name: string;
  institution_kind: string;
  network_id: number;
  network_title: string;
};

/**
 * The accept page for an institution's referral link.
 *
 * The person arriving here is usually being helped by someone - a
 * caseworker, a librarian - and may have no email address yet. So the page
 * does three things and stops: says who pointed them here, says plainly
 * what the community is and is not, and offers one button.
 *
 * It states the privacy arrangement to the PERSON, not only to the
 * institution: the agency is shown a count and nothing else, and no record
 * connecting the two is kept. That is worth saying out loud to someone who
 * has had a great deal decided for them already.
 */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const t = await getTranslations("join");
  const supabase = await createClient();

  // Resolved through a function, not a table read: a token is a secret, so
  // corridor_invites has no select policy for the public and cannot be
  // enumerated. An invalid, expired, withdrawn or exhausted token all
  // return nothing, so none of them can be told apart from a guess.
  const { data } = await supabase.rpc("corridor_invite_preview", { p_token: token });
  const preview = ((data ?? []) as Preview[])[0] ?? null;

  if (!preview) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="font-display text-2xl text-ink">{t("invalidTitle")}</h1>
        <p className="text-body">
          {t.rich("invalidBody", {
            home: (chunks) => (
              <Link href="/" className="text-primary underline">
                {chunks}
              </Link>
            ),
            contact: (chunks) => (
              <Link href="/contact" className="text-primary underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("network_members")
        .select("network_id")
        .eq("network_id", preview.network_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const institution = preview.institution_name;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-[1.6rem] leading-tight text-balance text-ink">
        {t("heading", { institution })}
      </h1>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted">{t("networkLab")}</p>
        <p className="font-medium text-ink">{preview.network_title}</p>
      </div>

      <div className="flex flex-col gap-3 text-sm text-body">
        <p>{t("whatThisIs", { institution })}</p>
        <p>{t("publicNote")}</p>
        {/* Said to the person, not buried in a policy page. */}
        <p className="text-muted">{t("privacyNote", { institution })}</p>
        <p className="text-muted">{t("leaveNote")}</p>
      </div>

      {membership ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink">{t("alreadyMember")}</p>
          <Link
            href={`/networks/${preview.network_id}`}
            className="self-start text-primary underline"
          >
            {t("goToCommunity")}
          </Link>
        </div>
      ) : user ? (
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full">{t("joinCta")}</SubmitButton>
        </form>
      ) : (
        <Link
          href={`/sign-in?returnTo=${encodeURIComponent(`/join/${token}`)}`}
          className="w-full rounded-md bg-primary px-3 py-2 text-center font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {t("signInCta")}
        </Link>
      )}
    </div>
  );
}
