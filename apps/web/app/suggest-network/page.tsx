import { getTranslations } from "next-intl/server";
import { SuggestNetworkForm } from "@/app/suggest-network/suggest-network-form";

export default async function SuggestNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const t = await getTranslations("suggestNetwork");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-2xl text-ink">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        {sent && (
          <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
            {t("sent")}
          </p>
        )}
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <SuggestNetworkForm />
      </div>
    </div>
  );
}
