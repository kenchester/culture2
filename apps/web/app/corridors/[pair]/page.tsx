import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { corridorIdsFromSlug, corridorSlug, slugWithId } from "@/lib/slug";
import { getCorridorContext, type CorridorContext } from "@/lib/corridor-context";
import { CorridorContextBlock } from "@/app/networks/[id]/corridor-context-block";
import type { Locale } from "@/lib/locale";
import { getDisplayName, type Author } from "@/lib/profiles";
import { LocalDateTime } from "@/components/local-datetime";
import { FormError } from "@/components/ui/form-error";
import { Field, fieldClass, Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelTrip, postCorridorAnswer, postTrip } from "@/app/corridors/[pair]/actions";

type Trip = {
  id: number;
  user_id: string;
  from_place_id: number;
  to_place_id: number;
  travel_date: string;
  offering: string;
  note: string | null;
  profile: Author | null;
};

type Answer = {
  id: number;
  question_id: number;
  from_place_id: number;
  to_place_id: number;
  body: string;
  profile: Author | null;
};

type NetworkRow = { id: number; title: string; member_count: number | null };

/**
 * A corridor, which is a pair of places rather than a direction between
 * them.
 *
 * Deliberately derived rather than stored. A corridor has no identity of
 * its own yet - it is exactly "these two places" - so inventing a table
 * would mean a migration, a backfill and a second source of truth for
 * something a sorted pair of ids already expresses. The table can come
 * later, when something genuinely needs to live on a corridor.
 *
 * The two directions stay separate networks on purpose. Fuzhounese New
 * York and Americans in Xiamen share a route and almost nothing else -
 * different languages, different concerns, and a population ratio of
 * about a hundred to one. What they do share is everything on this page:
 * the reference facts, the institutions, and eventually the people
 * travelling between them.
 */
async function loadCorridor(pair: string, locale: Locale) {
  const ids = corridorIdsFromSlug(pair);
  if (!ids) return null;
  const [lowId, highId] = ids;

  const supabase = await createClient();
  const { data: places } = await supabase
    .from("places")
    .select("id, name, hidden_from_search")
    .in("id", [lowId, highId]);

  const low = (places ?? []).find((p) => p.id === lowId);
  const high = (places ?? []).find((p) => p.id === highId);
  // hidden_from_search covers organisation anchors and test geographies.
  if (!low || !high || low.hidden_from_search || high.hidden_from_search) return null;

  // Both directions, if they exist. Either may be absent - most corridors
  // have only ever been created one way round.
  const [{ data: lowToHigh }, { data: highToLow }] = await Promise.all([
    supabase
      .from("networks")
      .select("id, title, member_count")
      .eq("origin_place_id", lowId)
      .eq("location_place_id", highId)
      .maybeSingle(),
    supabase
      .from("networks")
      .select("id, title, member_count")
      .eq("origin_place_id", highId)
      .eq("location_place_id", lowId)
      .maybeSingle(),
  ]);

  // Reference facts are per-destination, so gather whichever ends we have
  // data for and show both.
  const contexts = (
    await Promise.all([
      getCorridorContext(supabase, { origin_place_id: lowId, location_place_id: highId }),
      getCorridorContext(supabase, { origin_place_id: highId, location_place_id: lowId }),
    ])
  ).filter(Boolean) as CorridorContext[];

  const [{ data: trips }, { data: questions }, { data: answers }, { data: auth }] =
    await Promise.all([
      // RLS returns nothing at all unless the viewer is in a community on
      // this route, so "empty" and "not allowed" look the same here by
      // design - the page says which, using membership below.
      supabase
        .from("trips")
        .select(
          "id, user_id, from_place_id, to_place_id, travel_date, offering, note, profile:user_id(id, username, first_name, last_name, img_path)",
        )
        .in("from_place_id", [lowId, highId])
        .in("to_place_id", [lowId, highId])
        .order("travel_date"),
      supabase.from("corridor_questions").select("id, key, sort_order").order("sort_order"),
      supabase
        .from("corridor_answers")
        .select(
          "id, question_id, from_place_id, to_place_id, body, profile:user_id(id, username, first_name, last_name, img_path)",
        )
        .in("from_place_id", [lowId, highId])
        .in("to_place_id", [lowId, highId])
        .order("created_at"),
      supabase.auth.getUser(),
    ]);

  const user = auth?.user ?? null;
  const { data: isMember } = user
    ? await supabase.rpc("is_corridor_member", { p_a: lowId, p_b: highId })
    : { data: false };

  return {
    user,
    isMember: Boolean(isMember),
    trips: ((trips ?? []) as unknown as Trip[]),
    questions: (questions ?? []) as { id: number; key: string }[],
    answers: ((answers ?? []) as unknown as Answer[]),
    low: { id: lowId, name: low.name as string },
    high: { id: highId, name: high.name as string },
    lowToHigh: (lowToHigh as NetworkRow | null) ?? null,
    highToLow: (highToLow as NetworkRow | null) ?? null,
    contexts,
    locale,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("corridorPage");
  const loaded = await loadCorridor(pair, locale);
  if (!loaded) return {};

  return shareMetadata({
    title: t("title", { a: loaded.low.name, b: loaded.high.name }),
    description: previewText(t("metaDescription", { a: loaded.low.name, b: loaded.high.name })),
    path: `/corridors/${corridorSlug(loaded.low, loaded.high)}`,
  });
}

export default async function CorridorPage({
  params,
  searchParams,
}: {
  params: Promise<{ pair: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { pair } = await params;
  const { error } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("corridorPage");
  const loaded = await loadCorridor(pair, locale);
  if (!loaded) notFound();

  const { low, high, lowToHigh, highToLow, contexts, trips, questions, answers, user, isMember } =
    loaded;
  const tTrips = await getTranslations("trips");
  const tQ = await getTranslations("corridorQuestions");
  const pairSlug = corridorSlug(low, high);
  const directionOptions = [
    { value: `${low.id}:${high.id}`, label: `${low.name} → ${high.name}` },
    { value: `${high.id}:${low.id}`, label: `${high.name} → ${low.name}` },
  ];

  const directions: { from: { id: number; name: string }; to: { id: number; name: string }; network: NetworkRow | null }[] =
    [
      { from: low, to: high, network: lowToHigh },
      { from: high, to: low, network: highToLow },
    ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title", { a: low.name, b: high.name })}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      {error && <FormError>{error}</FormError>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("directionsHeading")}</h2>
        {directions.map((direction) => (
          <div
            key={`${direction.from.id}-${direction.to.id}`}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-surface p-4"
          >
            {direction.network ? (
              <>
                <Link
                  href={`/networks/${slugWithId(direction.network.title, direction.network.id)}`}
                  className="font-medium text-ink underline hover:text-primary"
                >
                  {direction.network.title}
                </Link>
                <span className="text-sm text-muted tabular-nums">
                  {t("membersLabel", { count: direction.network.member_count ?? 0 })}
                </span>
              </>
            ) : (
              <>
                <span className="text-body">
                  {direction.from.name} → {direction.to.name}
                </span>
                <span className="flex items-baseline gap-3 text-sm">
                  <span className="text-muted">{t("noNetwork")}</span>
                  {/* Prefilled, so "start it" lands on Launch rather than
                      on an empty search form. */}
                  <Link
                    href={`/search/results?originId=${direction.from.id}&originQuery=${encodeURIComponent(direction.from.name)}&locationId=${direction.to.id}&locationQuery=${encodeURIComponent(direction.to.name)}`}
                    className="text-primary underline"
                  >
                    {t("startThis")}
                  </Link>
                </span>
              </>
            )}
          </div>
        ))}
      </section>


      {/* The questions. This is the content that makes a corridor page
          worth landing on before anyone has joined - and answering
          requires membership, so it is a reason to join rather than a
          substitute for joining. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-ink">{tQ("heading")}</h2>
        <p className="text-sm text-muted">{tQ("intro")}</p>
        {!isMember && <p className="text-sm text-muted">{tQ("memberOnly")}</p>}

        {questions.map((question) => (
          <div key={question.id} className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="font-medium text-ink">{tQ(`question.${question.key}`)}</p>
            {directions.map((direction) => {
              const forThis = answers.filter(
                (a) =>
                  a.question_id === question.id &&
                  a.from_place_id === direction.from.id &&
                  a.to_place_id === direction.to.id,
              );
              return (
                <div key={`${question.id}-${direction.to.id}`} className="flex flex-col gap-1">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {tQ("directionTo", { place: direction.to.name })}
                  </p>
                  {forThis.length === 0 ? (
                    <p className="text-sm text-muted">{tQ("unanswered")}</p>
                  ) : (
                    forThis.map((answer) => (
                      <div key={answer.id} className="flex flex-col gap-0.5">
                        <p className="whitespace-pre-line text-body">{answer.body}</p>
                        <p className="text-xs text-muted">
                          {answer.profile ? getDisplayName(answer.profile) : ""}
                        </p>
                      </div>
                    ))
                  )}
                  {isMember && (
                    <form action={postCorridorAnswer} className="flex flex-col gap-2 pt-1">
                      <input type="hidden" name="pair" value={pairSlug} />
                      <input type="hidden" name="questionId" value={question.id} />
                      <input
                        type="hidden"
                        name="direction"
                        value={`${direction.from.id}:${direction.to.id}`}
                      />
                      <Textarea
                        name="body"
                        rows={2}
                        required
                        placeholder={tQ("answerPlaceholder")}
                        aria-label={tQ("answerLabel")}
                      />
                      <SubmitButton className="self-start">{tQ("submit")}</SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {/* Trips. Deliberately not a marketplace - see 00000000000096. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{tTrips("heading")}</h2>
        <p className="text-sm text-muted">{tTrips("intro")}</p>

        {!isMember ? (
          <p className="text-sm text-muted">{tTrips("memberOnly")}</p>
        ) : (
          <>
            {trips.length === 0 && <p className="text-sm text-muted">{tTrips("none")}</p>}
            {trips.map((trip) => {
              const from = trip.from_place_id === low.id ? low : high;
              const to = trip.to_place_id === low.id ? low : high;
              return (
                <div
                  key={trip.id}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-sm"
                >
                  <p className="font-medium text-ink">
                    {from.name} → {to.name} · <LocalDateTime iso={trip.travel_date} />
                  </p>
                  <p className="text-body">{tTrips(`offering.${trip.offering}`)}</p>
                  {trip.note && <p className="text-muted">{trip.note}</p>}
                  <p className="text-muted">
                    {trip.profile ? getDisplayName(trip.profile) : ""}
                  </p>
                  {trip.profile && user && trip.user_id !== user.id && (
                    <Link href={`/profile/${trip.profile.id}`} className="self-start text-primary underline">
                      {tTrips("messageThem")}
                    </Link>
                  )}
                  {user && trip.user_id === user.id && (
                    <form action={cancelTrip}>
                      <input type="hidden" name="pair" value={pairSlug} />
                      <input type="hidden" name="tripId" value={trip.id} />
                      <SubmitButton className="self-start !bg-transparent !px-0 !text-sm !font-normal !text-muted underline hover:!text-primary">
                        {tTrips("cancel")}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}

            <form
              action={postTrip}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <h3 className="font-medium text-ink">{tTrips("addHeading")}</h3>
              <input type="hidden" name="pair" value={pairSlug} />
              <Field>
                <Label htmlFor="direction">{tTrips("direction")}</Label>
                <select id="direction" name="direction" required className={fieldClass} defaultValue="">
                  <option value="" disabled>
                    —
                  </option>
                  {directionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <Label htmlFor="travelDate">{tTrips("dateLabel")}</Label>
                <Input id="travelDate" name="travelDate" type="date" required />
              </Field>
              <Field>
                <Label htmlFor="offering">{tTrips("offeringLabel")}</Label>
                <select id="offering" name="offering" required className={fieldClass} defaultValue="meet">
                  <option value="carry">{tTrips("offering.carry")}</option>
                  <option value="meet">{tTrips("offering.meet")}</option>
                  <option value="advice">{tTrips("offering.advice")}</option>
                </select>
              </Field>
              <Field>
                <Label htmlFor="note">{tTrips("noteLabel")}</Label>
                <Input id="note" name="note" placeholder={tTrips("notePlaceholder")} />
              </Field>
              <SubmitButton className="self-start">{tTrips("submit")}</SubmitButton>
            </form>
          </>
        )}

        {/* Shown whether or not anyone is a member: this is the part that
            can actually hurt somebody. */}
        <p className="rounded-md border border-border bg-primary-light/40 p-3 text-xs text-body">
          {tTrips("responsibility")}
        </p>
      </section>

      {contexts.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-ink">{t("factsHeading")}</h2>
          {contexts.map((context) => (
            <CorridorContextBlock
              key={context.cityName}
              context={context}
              cityPlaceId={context.cityName === low.name ? low.id : high.id}
              isEmpty={false}
            />
          ))}
        </section>
      )}
    </div>
  );
}
