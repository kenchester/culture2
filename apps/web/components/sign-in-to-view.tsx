import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { GatedContext } from "@/lib/gated-access";

/**
 * Shown when the content is real but belongs to a school the viewer isn't
 * signed in to - instead of a 404, which would tell them nothing and leave
 * them nowhere to go.
 *
 * returnTo carries them straight back to the link they followed once they
 * authenticate, so a shared permalink survives the detour through sign-in.
 */
export async function SignInToView({
  gated,
  returnTo,
}: {
  gated: GatedContext;
  returnTo: string;
}) {
  const t = await getTranslations("gatedContent");
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
      <p className="text-body">
        {gated.networkTitle
          ? t("bodyWithNetwork", { network: gated.networkTitle, school: gated.orgName })
          : t("body", { school: gated.orgName })}
      </p>
      <Link
        href={signInHref}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90"
      >
        {t("signIn")}
      </Link>
      <p className="text-sm text-muted">
        {t.rich("notAMember", {
          home: (chunks) => (
            <Link href="/" className="text-primary underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
