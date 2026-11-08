import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/app/search/search-form";
import { DescribeYourselfForm } from "@/app/search/describe-yourself-form";
import { FormError } from "@/components/ui/form-error";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("search");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl text-ink">{t("pageHeading")}</h1>
        {error && <FormError>{error}</FormError>}
        <DescribeYourselfForm />
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          {t("orDivider")}
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
        <SearchForm />
      </div>
      <Link href="/suggest-network" className="text-center text-sm text-muted hover:text-primary">
        {t("suggestNetwork")}
      </Link>
    </div>
  );
}
