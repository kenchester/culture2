import Link from "next/link";
import { getTranslations } from "next-intl/server";

function Bold({ chunks }: { chunks: React.ReactNode }) {
  return <span className="font-medium text-ink">{chunks}</span>;
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const tCommon = await getTranslations("common");
  const richB = { b: (chunks: React.ReactNode) => <Bold chunks={chunks} /> };

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
        <h2 className="font-display text-xl text-ink">{t("informationWeCollect.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t.rich("informationWeCollect.account", richB)}</p>
          <p>{t.rich("informationWeCollect.profile", richB)}</p>
          <p>{t.rich("informationWeCollect.networkActivity", richB)}</p>
          <p>{t.rich("informationWeCollect.messages", richB)}</p>
          <p>{t.rich("informationWeCollect.suggestedNetwork", richB)}</p>
          <p>{t.rich("informationWeCollect.contactForm", richB)}</p>
          <p>{t.rich("informationWeCollect.usage", richB)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("howWeUseInformation.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("howWeUseInformation.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("howWeShareInformation.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("howWeShareInformation.intro")}</p>
          <p>{t.rich("howWeShareInformation.supabase", richB)}</p>
          <p>{t.rich("howWeShareInformation.resend", richB)}</p>
          <p>{t.rich("howWeShareInformation.vercel", richB)}</p>
          <p>{t("howWeShareInformation.legal")}</p>
          <p>{t("howWeShareInformation.members")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("cookies.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("cookies.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("dataRetention.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("dataRetention.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("yourRightsAndChoices.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("yourRightsAndChoices.p1")}</p>
          <p>{t("yourRightsAndChoices.p2")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("childrensPrivacy.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("childrensPrivacy.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("security.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("security.body")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">{t("changesToThisPolicy.heading")}</h2>
        <div className="flex flex-col gap-2 text-body">
          <p>{t("changesToThisPolicy.body")}</p>
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
