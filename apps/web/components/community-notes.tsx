import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { postNote } from "@/app/notes/actions";
import { getDisplayName, type Author } from "@/lib/profiles";
import { LocalDateTime } from "@/components/local-datetime";
import { Field, fieldClass, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

const PLACE_TOPICS = ["population", "consulate", "distance", "twinning", "general"] as const;
// 'speakers' is the one that matters here: for most of these languages
// the census declines to count them, so the page's own figure is a
// category total and the people who know the real number are the only
// source there is.
const LANGUAGE_TOPICS = ["speakers", "endangerment", "general"] as const;

type Note = {
  id: number;
  topic: string;
  body: string;
  created_at: string;
  profile: Author | null;
};

/**
 * What people here say about the figures above.
 *
 * This is the inverted ask. Every other prompt on the site says
 * "contribute something", which an empty page makes unappealing and
 * unanchored. This one says "the census claims 71,461 - is that right?",
 * which is a thing somebody from that community will answer because it
 * is about them and might be wrong.
 *
 * The notes sit beside the sourced data rather than replacing it, so a
 * reader sees the official figure and the person disputing it at the
 * same time. That is more honest than either alone.
 */
export async function CommunityNotes({
  supabase,
  placeA,
  placeB,
  languageId,
  returnTo,
  signedIn,
}: {
  supabase: SupabaseClient;
  /** A city, or the first end of a corridor. Omitted for a language. */
  placeA?: number;
  /** Null for a city; both ends, in canonical order, for a corridor. */
  placeB?: number | null;
  /**
   * A language instead of a place. Exactly one of placeA / languageId is
   * set, which the community_notes_subject constraint (00000000000100)
   * enforces at the database rather than trusting every caller here.
   */
  languageId?: number;
  returnTo: string;
  signedIn: boolean;
}) {
  const t = await getTranslations("notes");

  // Which topics are worth offering depends on what the page states. A
  // city page has no endangerment status to dispute and a language page
  // has no consulate, and a select full of irrelevant options is how a
  // form teaches people not to read it.
  const topics = languageId ? LANGUAGE_TOPICS : PLACE_TOPICS;

  const base = supabase
    .from("community_notes")
    .select("id, topic, body, created_at, profile:user_id(id, username, first_name, last_name, img_path)")
    .is("hidden_at", null)
    .order("created_at", { ascending: false });

  let data: unknown[] | null = null;
  if (languageId) {
    ({ data } = await base.eq("language_id", languageId));
  } else {
    const query = base.eq("place_a", placeA!);
    ({ data } = placeB ? await query.eq("place_b", placeB) : await query.is("place_b", null));
  }
  const notes = (data ?? []) as unknown as Note[];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-ink">{t("heading")}</h2>
      {/* The ask is sharper on a language page, because the gap is
          sharper: the figure above is usually a census category that
          names two dozen other languages, so the people reading are the
          only source there is for the real one. */}
      <p className="text-sm text-body">{t(languageId ? "promptLanguage" : "prompt")}</p>

      {notes.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">
                {t(`topic.${note.topic}`)}
              </p>
              <p className="whitespace-pre-line text-body">{note.body}</p>
              <p className="text-xs text-muted">
                {note.profile ? getDisplayName(note.profile) : ""} ·{" "}
                <LocalDateTime iso={note.created_at} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        <form action={postNote} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          {languageId ? (
            <input type="hidden" name="languageId" value={languageId} />
          ) : (
            <>
              <input type="hidden" name="placeA" value={placeA} />
              {placeB ? <input type="hidden" name="placeB" value={placeB} /> : null}
            </>
          )}
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field>
            <Label htmlFor="topic">{t("topicLabel")}</Label>
            <select id="topic" name="topic" className={fieldClass} defaultValue={topics[0]}>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {t(`topic.${topic}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Label htmlFor="body">{t("bodyLabel")}</Label>
            <Textarea id="body" name="body" rows={3} required placeholder={t("bodyPlaceholder")} />
          </Field>
          <SubmitButton className="self-start">{t("submit")}</SubmitButton>
        </form>
      ) : (
        <Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} className="text-sm text-primary underline">
          {t("signIn")}
        </Link>
      )}
    </section>
  );
}
