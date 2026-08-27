import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { checkSchoolDomain } from "@/app/learn/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// No client state needed - a plain server-rendered form posting to a
// server action, same shape as FaithSearchForm/RedeemedSearchForm. Renders
// near the top of the landing page regardless of auth state; the domain
// check itself works anonymously.
export async function DomainCheckBanner({
  domainMatch,
  domainNoMatch,
  domainError,
}: {
  domainMatch?: string;
  domainNoMatch?: string;
  domainError?: string;
}) {
  const t = await getTranslations("learn");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div>
        <h2 className="font-display text-lg text-ink">{t("bannerHeading")}</h2>
        <p className="text-sm text-muted">{t("bannerSubheading")}</p>
      </div>
      <form action={checkSchoolDomain} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          name="domain"
          placeholder={t("bannerPlaceholder")}
          className="flex-1"
          aria-label={t("bannerHeading")}
        />
        <Button type="submit">{t("bannerSubmit")}</Button>
      </form>
      {domainMatch && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {t("bannerMatch", { domain: domainMatch })}
        </p>
      )}
      {domainNoMatch && (
        <div className="flex flex-col gap-2 rounded-md bg-success-bg px-3 py-2 text-sm text-body">
          <p>{t("bannerNoMatch", { domain: domainNoMatch })}</p>
          <Link
            href={`/contact?subject=${encodeURIComponent("CultureMesh Learn Interest")}&message=${encodeURIComponent(`School: ${domainNoMatch}`)}`}
            className="self-start font-medium text-primary hover:underline"
          >
            {t("bannerRequestButton")}
          </Link>
        </div>
      )}
      {domainError && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{domainError}</p>
      )}
      <p className="text-sm text-muted">{t("bannerSeeExamples")}</p>
    </div>
  );
}
