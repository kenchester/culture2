import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { TrainingSearchForm, type LocationOption } from "@/app/training/training-search-form";

export const metadata: Metadata = {
  title: "AI training networks — CultureMesh",
};

// Washington D.C. is a city in this data, not a region: the 50 states are
// the only type='region' rows under the United States, and the capital has
// no state to sit under. Included by id so the list is "50 states plus
// D.C." as intended rather than 50 states and a gap.
const DC_PLACE_ID = 23949;
const UNITED_STATES_PLACE_ID = 233;

/**
 * The entry point for people joining the AI training program.
 *
 * The deliberate narrowing here is the whole point: origin can only be a
 * LANGUAGE, and location only a US state or D.C. Networks for this program
 * need to be findable by other participants, and the main site's full
 * origin/location freedom produces networks so specific that nobody else
 * ever lands in the same one.
 */
export default async function TrainingPage() {
  const t = await getTranslations("training");
  const supabase = await createClient();

  const [{ data: states }, { data: dc }] = await Promise.all([
    supabase
      .from("places")
      .select("id, name")
      .eq("type", "region")
      .eq("parent_id", UNITED_STATES_PLACE_ID)
      .order("name"),
    supabase.from("places").select("id, name").eq("id", DC_PLACE_ID).maybeSingle(),
  ]);

  const locations: LocationOption[] = [
    ...(states ?? []).map((s) => ({ id: s.id as number, name: s.name as string })),
    ...(dc ? [{ id: dc.id as number, name: dc.name as string }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl text-ink">{t("title")}</h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-ink">{t("findTitle")}</h2>
        <p className="text-sm text-body">{t("findBody")}</p>
        <TrainingSearchForm locations={locations} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("rulesTitle")}</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-body">
          <li>{t("rules.authentic")}</li>
          <li>{t("rules.language")}</li>
          <li>{t("rules.onTopic")}</li>
          <li>{t("rules.respect")}</li>
        </ul>
        <p className="text-sm text-muted">{t("rulesFootnote")}</p>
      </section>
    </div>
  );
}
