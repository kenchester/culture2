import { getTranslations } from "next-intl/server";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const tCommon = await getTranslations("common");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="font-display text-4xl text-ink">{t("heading")}</h1>

      <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted">
        {tCommon("legalDisclaimer")}
      </p>

      <p className="text-body">{t("paragraph1")}</p>
      <p className="text-body">{t("paragraph2")}</p>
      <p className="text-body">{t("paragraph3")}</p>
      <p className="text-body">{t("paragraph4")}</p>
    </div>
  );
}
