import { getTranslations } from "next-intl/server";
import { FaithSearchForm } from "@/app/faith/faith-search-form";

export default async function FaithPage() {
  const t = await getTranslations("faith");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl text-ink">{t("heading")}</h1>
        <FaithSearchForm />
      </div>
    </div>
  );
}
