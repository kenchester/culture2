import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reactToStat } from "@/app/reactions/actions";

/**
 * "Does this look right?" reduced to one tap.
 *
 * The sibling of CommunityNotes, not a replacement for it - a note
 * explains what is wrong and by how much, which is worth more than a
 * reaction ever could be. But a note needs the visitor to already be
 * engaged enough to write a sentence, and on these pages that engagement
 * basically never arrives: 23,000+ page views have produced zero notes
 * site-wide. Most of those visitors are not wrong about the figure, they
 * are silently confirming it and leaving. This gives that silent
 * confirmation somewhere to go - one tap, no account-holder conviction
 * required beyond "yes, that's right" or "no, that's off" - and once
 * there are a few taps, the count itself becomes the social proof the
 * next visitor sees.
 *
 * A plain form with two submit buttons, not a client component with
 * onClick - the same reason CommunityNotes stays server-rendered: this
 * has to work with no JavaScript at all, and a tap is the one interaction
 * a bare HTML form was always good at.
 */
export async function StatReaction({
  supabase,
  placeA,
  placeB,
  languageId,
  topic,
  returnTo,
  signedIn,
  viewerId,
}: {
  supabase: SupabaseClient;
  placeA?: number;
  placeB?: number | null;
  languageId?: number;
  topic: "population" | "consulate" | "distance" | "twinning" | "speakers" | "endangerment" | "general";
  returnTo: string;
  signedIn: boolean;
  /** The signed-in viewer's own id, to highlight their existing tap. */
  viewerId?: string;
}) {
  const t = await getTranslations("reactions");

  const base = supabase.from("stat_reactions").select("is_accurate, user_id").eq("topic", topic);
  const query = languageId
    ? base.eq("language_id", languageId)
    : placeB
      ? base.eq("place_a", placeA!).eq("place_b", placeB)
      : base.eq("place_a", placeA!).is("place_b", null);
  const { data } = await query;
  const rows = data ?? [];
  const agree = rows.filter((r) => r.is_accurate).length;
  const total = rows.length;
  const myReaction = viewerId ? rows.find((r) => r.user_id === viewerId)?.is_accurate : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {signedIn ? (
        <form action={reactToStat} className="flex items-center gap-1">
          <input type="hidden" name="placeA" value={placeA ?? ""} />
          <input type="hidden" name="placeB" value={placeB ?? ""} />
          <input type="hidden" name="languageId" value={languageId ?? ""} />
          <input type="hidden" name="topic" value={topic} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            name="isAccurate"
            value="true"
            className={`rounded-md border px-2 py-1 hover:border-success hover:text-success ${
              myReaction === true
                ? "border-success bg-success-bg text-success"
                : "border-border text-body"
            }`}
          >
            {t("looksRight")}
          </button>
          <button
            type="submit"
            name="isAccurate"
            value="false"
            className={`rounded-md border px-2 py-1 hover:border-error hover:text-error ${
              myReaction === false ? "border-error bg-error-bg text-error" : "border-border text-body"
            }`}
          >
            {t("looksOff")}
          </button>
        </form>
      ) : (
        <Link
          href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="rounded-md border border-border px-2 py-1 text-muted hover:border-primary hover:text-primary"
        >
          {t("signInToReact")}
        </Link>
      )}
      {/* Label and the fraction kept as separate nodes, not one
          interpolated sentence - a sentence with two numbers in it is
          exactly the shape that has broken translation elsewhere on this
          site (a figure wedged mid-phrase, needing plural agreement no
          single ICU form covers across ten locales). */}
      {total > 0 && (
        <span className="text-muted">
          {t("summary")} <span className="tabular-nums text-ink">{agree}/{total}</span>
        </span>
      )}
    </div>
  );
}
