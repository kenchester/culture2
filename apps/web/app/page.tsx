import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/app/search/search-form";
import { previewText, shareMetadata } from "@/lib/share-metadata";

const stepKeys = ["search", "joinLaunch", "connect"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return shareMetadata({
    title: t("heading"),
    description: previewText(t("subheading")),
    path: "/",
  });
}

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

      {/* The reference pages were reachable from the sitemap and nothing
          else - findable by a crawler and by no human. Somebody who is
          not ready to search for their own community should still have
          somewhere to go. */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-12">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-display text-xl text-ink">{t("browseHeading")}</h2>
          <p className="text-sm text-body">{t("browseIntro")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/cities" className="text-primary underline">{t("browseCities")}</Link>
            </li>
            <li>
              <Link href="/corridors" className="text-primary underline">{t("browseCorridors")}</Link>
            </li>
            <li>
              <Link href="/outposts" className="text-primary underline">{t("browseOutposts")}</Link>
            </li>
          </ul>
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
