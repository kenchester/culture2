import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { corridorSlug } from "@/lib/slug";
import { recordPageView } from "@/lib/page-views";
import type { Locale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("corridorIndex");
  return shareMetadata({
    title: t("title"),
    description: previewText(t("metaDescription")),
    path: "/corridors",
  });
}

/**
 * Every corridor, derived from the networks that exist.
 *
 * One row per unordered pair, so the two directions of a route do not
 * appear as two entries - which is the whole point of the corridor being
 * a pair rather than a direction.
 */
export default async function CorridorsIndexPage() {
  const t = await getTranslations("corridorIndex");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  recordPageView("/corridors");

  const { data: networks } = await supabase
    .from("networks")
    .select("id, origin_place_id, location_place_id, member_count")
    .not("origin_place_id", "is", null);

  const placeIds = [
    ...new Set((networks ?? []).flatMap((n) => [n.origin_place_id, n.location_place_id])),
  ].filter(Boolean) as number[];
  const { data: places } = placeIds.length
    ? await supabase
        .from("places")
        .select("id, name, hidden_from_search")
        .in("id", placeIds)
    : { data: [] };
  const placeById = new Map((places ?? []).map((p) => [p.id as number, p]));

  // Collapse the two directions into one row, summing the people at both
  // ends - a corridor with three on one side and two on the other has
  // five, not two separate entries.
  const corridors = new Map<string, { a: { id: number; name: string }; b: { id: number; name: string }; people: number }>();
  for (const network of networks ?? []) {
    const origin = placeById.get(network.origin_place_id as number);
    const location = placeById.get(network.location_place_id as number);
    // hidden_from_search covers organisation anchors and test geographies.
    if (!origin || !location || origin.hidden_from_search || location.hidden_from_search) continue;

    const a = { id: origin.id as number, name: origin.name as string };
    const b = { id: location.id as number, name: location.name as string };
    const slug = corridorSlug(a, b);
    const existing = corridors.get(slug);
    if (existing) {
      existing.people += (network.member_count as number) ?? 0;
    } else {
      corridors.set(slug, { a, b, people: (network.member_count as number) ?? 0 });
    }
  }

  const rows = [...corridors.entries()].sort(
    (x, y) => y[1].people - x[1].people || x[1].a.name.localeCompare(y[1].a.name),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title")}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">{t("corridorColumn")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("peopleColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([slug, corridor]) => (
                <tr key={slug} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <Link href={`/corridors/${slug}`} className="text-ink underline hover:text-primary">
                      {corridor.a.name} ↔ {corridor.b.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-body tabular-nums">
                    {corridor.people.toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
