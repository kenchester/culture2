import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { slugWithId } from "@/lib/slug";
import { recordPageView } from "@/lib/page-views";
import type { Locale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cityIndex");
  return shareMetadata({
    title: t("title"),
    description: previewText(t("metaDescription")),
    path: "/cities",
  });
}

/**
 * Every city with loaded statistics, largest foreign-born population
 * first.
 *
 * These pages existed before this one did, reachable only from the
 * sitemap - which is to say reachable by a crawler and by nobody else. An
 * index is the cheapest fix, and sorting by foreign-born population makes
 * it a list worth reading rather than an alphabetical dump.
 */
export default async function CitiesIndexPage() {
  const t = await getTranslations("cityIndex");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  recordPageView("/cities");

  const { data: stats } = await supabase
    .from("city_origin_stats")
    .select("city_place_id, origin_label, people, is_total")
    .order("people", { ascending: false })
    .limit(1000);

  // One row per city: its total, and the single largest origin.
  const totals = new Map<number, number>();
  const topOrigin = new Map<number, string>();
  for (const row of stats ?? []) {
    const id = row.city_place_id as number;
    if (row.is_total) totals.set(id, row.people as number);
    else if (!topOrigin.has(id)) topOrigin.set(id, row.origin_label as string);
  }

  const ids = [...totals.keys()];
  const { data: places } = ids.length
    ? await supabase.from("places").select("id, name").in("id", ids)
    : { data: [] };
  const nameFor = new Map((places ?? []).map((p) => [p.id as number, p.name as string]));

  const rows = [...totals.entries()]
    .filter(([id]) => nameFor.has(id))
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title")}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">{t("cityColumn")}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                {t("foreignBornColumn")}
              </th>
              <th scope="col" className="py-2 font-medium">{t("topOriginColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, total]) => (
              <tr key={id} className="border-b border-border">
                <td className="py-2 pr-4">
                  <Link
                    href={`/cities/${slugWithId(nameFor.get(id)!, id)}`}
                    className="text-ink underline hover:text-primary"
                  >
                    {nameFor.get(id)}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-right text-body tabular-nums">
                  {total.toLocaleString(locale)}
                </td>
                <td className="py-2 text-body">{topOrigin.get(id) ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">{t("sourceNote")}</p>
    </div>
  );
}
