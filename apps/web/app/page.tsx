import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/app/search/search-form";

const stepKeys = ["search", "joinLaunch", "connect"] as const;

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-10 text-center sm:py-12">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
              {t("heading")}
            </h1>
            <p className="mx-auto max-w-xl text-base text-body">{t("subheading")}</p>
          </div>

          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 text-left shadow-sm">
            <SearchForm />
          </div>

          <Link href="/suggest-network" className="text-sm text-muted underline hover:text-primary">
            {t("suggestNetwork")}
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <div className="grid gap-10 sm:grid-cols-3">
          {stepKeys.map((key, i) => (
            <div key={key} className="flex flex-col gap-2">
              <span className="font-display text-3xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-lg font-semibold text-ink">{t(`steps.${key}.title`)}</h2>
              <p className="text-sm text-body">{t(`steps.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
