import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ten things worth recording, and which ones somebody already has.
 *
 * This exists because "help document your language" produces nothing. The
 * task has no edge: a speaker cannot tell when they would be finished, so
 * they never start. "How did your grandmother say goodbye?" is answerable
 * in forty seconds by someone who was not planning to contribute
 * anything, and ten of those is a corpus.
 *
 * Collapsed by default, and that is a requirement rather than a
 * preference. Most people arriving at a language page are reading, not
 * recording, and a ten-item homework list unfurled above the content
 * would be a wall of obligation on a page that is mostly reference
 * material. Open it and the ask is specific; leave it closed and the page
 * never mentions it again.
 *
 * <details> rather than a React disclosure for the same reason the
 * corridor questions use it: it works with JavaScript disabled, it is
 * keyboard-operable and screen-reader-labelled for free, and the browser
 * owns the open state so a server re-render never collapses it.
 */
export async function LanguagePrompts({
  supabase,
  languageId,
  networkId,
  canPost,
  signInHref,
}: {
  supabase: SupabaseClient;
  languageId: number;
  /**
   * Where a recording would go. Null on a language page when the viewer
   * is in none of its networks - the prompts are still worth showing, but
   * they lead to joining rather than straight to a composer.
   */
  networkId?: number | null;
  canPost: boolean;
  signInHref: string;
}) {
  const t = await getTranslations("languagePrompts");

  const [{ data: prompts }, { data: networks }] = await Promise.all([
    supabase
      .from("language_prompts")
      .select("id, key")
      .eq("active", true)
      .order("sort_order"),
    // Answers are counted across every network for this language, not
    // just the one being viewed. A recording of a lullaby is a recording
    // of a lullaby whether it was posted by the Hakka community in Miami
    // or the one in Toronto, and counting per network would show nine
    // zeroes to each of them.
    supabase.from("networks").select("id").eq("language_id", languageId),
  ]);

  if (!prompts || prompts.length === 0) return null;

  const networkIds = (networks ?? []).map((n) => n.id as number);
  const { data: answered } = networkIds.length
    ? await supabase
        .from("posts")
        .select("language_prompt_id")
        .in("network_id", networkIds)
        .not("language_prompt_id", "is", null)
        .is("deleted_at", null)
    : { data: [] };

  const counts = new Map<number, number>();
  for (const row of answered ?? []) {
    const id = row.language_prompt_id as number;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const done = prompts.filter((p) => counts.has(p.id as number)).length;

  return (
    <details className="rounded-lg border border-border bg-surface p-5">
      <summary className="cursor-pointer list-none font-medium text-primary marker:hidden [&::-webkit-details-marker]:hidden">
        {t("heading")}{" "}
        <span className="font-normal text-muted tabular-nums">
          {t("progress", { done, total: prompts.length })}
        </span>
      </summary>

      <div className="flex flex-col gap-4 pt-4">
        <p className="text-sm text-body">{t("intro")}</p>

        <ul className="flex flex-col gap-3">
          {prompts.map((prompt) => {
            const count = counts.get(prompt.id as number) ?? 0;
            return (
              <li
                key={prompt.id as number}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {t(`prompt.${prompt.key as string}.title`)}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {count > 0 ? t("recorded", { count }) : t("notRecorded")}
                  </span>
                </div>
                <p className="text-sm text-muted">{t(`prompt.${prompt.key as string}.ask`)}</p>
                {canPost && networkId ? (
                  // Lands on the network with the prompt already selected,
                  // so the composer opens with the question above it
                  // rather than an empty box the person has to remember
                  // the point of.
                  <Link
                    href={`/networks/${networkId}?prompt=${prompt.id}#post`}
                    className="self-start text-sm text-primary underline"
                  >
                    {t("record")}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>

        {!canPost && (
          <p className="text-sm text-muted">
            <Link href={signInHref} className="text-primary underline">
              {t("joinToRecord")}
            </Link>
          </p>
        )}

        {/* The thing a revitalisation group asks before recording
            anything, and they are right to ask it. Answering it on the
            page rather than in a terms document is the difference between
            a community that participates and one that has been burned by
            a linguist before. */}
        <p className="text-xs text-muted">{t("ownership")}</p>
      </div>
    </details>
  );
}
