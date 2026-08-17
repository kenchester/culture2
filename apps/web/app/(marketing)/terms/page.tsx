import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
  const t = await getTranslations("terms");
  const tCommon = await getTranslations("common");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl text-ink">{t("title")}</h1>
        <p className="text-sm text-muted">{t("lastUpdated")}</p>
      </div>

      <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted">
        {tCommon("legalDisclaimer")}
      </p>

      <p className="text-body">{t("intro")}</p>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("eligibility.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("eligibility.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("whatCultureMeshIs.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("whatCultureMeshIs.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("accounts.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("accounts.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("yourContent.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("yourContent.p1")}</p>
          <p>{t("yourContent.p2")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("communityConduct.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("communityConduct.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("embassyAndPartnerEmbeds.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("embassyAndPartnerEmbeds.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("intellectualProperty.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("intellectualProperty.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("disclaimers.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p className="uppercase">{t("disclaimers.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("limitationOfLiability.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p className="uppercase">{t("limitationOfLiability.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("indemnification.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("indemnification.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("governingLaw.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("governingLaw.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("termination.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("termination.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("changesToTheseTerms.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("changesToTheseTerms.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("miscellaneous.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("miscellaneous.body")}</p>
        </div>
      </div>

      <p className="text-body">
        {t.rich("contactUs", {
          link: (chunks) => (
            <Link href="/contact" className="text-primary underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
