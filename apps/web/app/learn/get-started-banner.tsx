import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Real schools already know they're on CultureMesh - unlike Acme's
// "is your school on CultureMesh?" checker (for a visitor who doesn't yet
// know), this is a direct sign-in CTA. Sign-in's own returnTo brings them
// straight back here, and claimWhitelistSeat (app/learn/[slug]/layout.tsx)
// recognizes/enrolls them the moment they land back on this page.
export async function GetStartedBanner({
  slug,
  orgName,
  domain,
}: {
  slug: string;
  orgName: string;
  domain: string | null;
}) {
  const t = await getTranslations("learn");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div>
        <h2 className="font-display text-lg text-ink">
          {domain ? t("getStartedHeadingWithDomain", { domain }) : t("getStartedHeadingGeneric")}
        </h2>
        <p className="text-sm text-muted">{t("getStartedSubheading", { name: orgName })}</p>
      </div>
      <Link
        href={`/sign-in?returnTo=${encodeURIComponent(`/learn/${slug}`)}`}
        className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        {t("getStartedButton")}
      </Link>
    </div>
  );
}
