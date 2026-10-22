import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { slugWithId } from "@/lib/slug";
import { recordPageView } from "@/lib/page-views";
import { ENDANGERMENT_SCALE, endangermentRank, isAtRisk } from "@/lib/language-reference";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("languageIndex");
  return shareMetadata({
    title: t("title"),
    description: previewText(t("metaDescription")),
    path: "/languages",
  });
}

type Row = {
  id: number;
  name: string;
  endangerment: string | null;
  coverage: string | null;
  networks: number;
};

/**
 * Every language we hold, most endangered first.
 *
 * The ordering is the argument. Alphabetical would put Afrikaans above
 * Tlingit and tell a reader nothing; sorting by status puts the languages
 * with the least time left at the top of the page, which is both the
 * honest editorial choice and the one that makes this list worth reading
 * for the people most likely to act on it.
 *
 * Languages at risk are listed first and separately from the rest. The
 * split is not decoration - it is the difference between a directory and
 * a priority list.
 */
export default async function LanguagesIndexPage() {
  const t = await getTranslations("languageIndex");
  const supabase = await createClient();
  recordPageView("/languages");

  const [{ data: languages }, { data: networks }] = await Promise.all([
    supabase
      .from("languages")
      .select("id, name, endangerment, coverage")
      .order("name")
      .limit(1000),
    supabase.from("networks").select("language_id").not("language_id", "is", null),
  ]);

  const networkCount = new Map<number, number>();
  for (const row of networks ?? []) {
    const id = row.language_id as number;
    networkCount.set(id, (networkCount.get(id) ?? 0) + 1);
  }

  const rows: Row[] = (languages ?? []).map((l) => ({
    id: l.id as number,
    name: l.name as string,
    endangerment: l.endangerment as string | null,
    coverage: l.coverage as string | null,
    networks: networkCount.get(l.id as number) ?? 0,
  }));

  // Most endangered first within the at-risk group; alphabetical in the
  // rest, where status no longer distinguishes anything useful.
  const atRisk = rows
    .filter((r) => isAtRisk(r.endangerment))
    .sort(
      (a, b) =>
        endangermentRank(b.endangerment) - endangermentRank(a.endangerment) ||
        a.name.localeCompare(b.name),
    );
  const rest = rows.filter((r) => !isAtRisk(r.endangerment));

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.endangerment) counts.set(row.endangerment, (counts.get(row.endangerment) ?? 0) + 1);
  }

  const languageLink = (row: Row) => (
    <Link
      href={`/languages/${slugWithId(row.name, row.id)}`}
      className="text-ink underline hover:text-primary"
    >
      {row.name}
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title")}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      {/* The scale, once, so neither table has to explain itself. */}
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">{t("scaleHeading")}</h2>
        <ul className="flex flex-col gap-1">
          {ENDANGERMENT_SCALE.map((status) => (
            <li key={status} className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-body">{t(`status.${status}`)}</span>
              <span className="text-muted tabular-nums">{counts.get(status) ?? 0}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t("scaleSource")}</p>
      </section>

      {atRisk.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-ink">{t("atRiskHeading")}</h2>
          <p className="text-sm text-muted">{t("atRiskIntro")}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">{t("languageColumn")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("statusColumn")}</th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {t("networksColumn")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="py-2 pr-4">{languageLink(row)}</td>
                    <td className="py-2 pr-4 text-body">
                      {t(`status.${row.endangerment as string}`)}
                    </td>
                    <td className="py-2 text-right text-muted tabular-nums">{row.networks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("otherHeading")}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {rest.map((row) => (
            <li key={row.id} className="text-sm">
              {languageLink(row)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
