import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { ShareLink } from "@/components/share-link";
import { castVote, nominate } from "@/app/outposts/elections/actions";
import { getDisplayName, type Author } from "@/lib/profiles";
import { LocalDateTime } from "@/components/local-datetime";
import { FormError } from "@/components/ui/form-error";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

type Phase = "nominating" | "pending" | "voting" | "closed";

function phaseOf(e: {
  nominations_close_at: string;
  voting_opens_at: string;
  voting_closes_at: string;
}): Phase {
  const now = Date.now();
  if (now < new Date(e.nominations_close_at).getTime()) return "nominating";
  if (now < new Date(e.voting_opens_at).getTime()) return "pending";
  if (now < new Date(e.voting_closes_at).getTime()) return "voting";
  return "closed";
}

// The lint rule against impure calls in render means the clock has to be
// read in a helper, same as phaseOf above.
function votingHasClosed(e: { voting_closes_at: string }) {
  return new Date(e.voting_closes_at).getTime() <= Date.now();
}

/**
 * Link-preview tags, which are what makes this page shareable at all: an
 * election link is forwarded into group chats, and without these it
 * arrives there as a bare URL.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("elections");
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, network_id, nominations_close_at, voting_opens_at, voting_closes_at")
    .eq("id", id)
    .is("cancelled_at", null)
    .maybeSingle();
  if (!election) return { title: t("title") };

  const { data: network } = await supabase
    .from("networks")
    .select("title")
    .eq("id", election.network_id)
    .maybeSingle();

  const phase = phaseOf(election);
  const description =
    phase === "nominating"
      ? t("metaNominating")
      : phase === "voting"
        ? t("metaVoting")
        : phase === "closed"
          ? t("metaClosed")
          : t("intro");

  return shareMetadata({
    title: t("metaTitle", { network: network?.title ?? `#${election.network_id}` }),
    description: previewText(`${description} ${t("roleFull")}`),
    path: `/outposts/elections/${election.id}`,
  });
}

export default async function ElectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const t = await getTranslations("elections");
  const supabase = await createClient();

  const ELECTION_COLUMNS =
    "id, network_id, roll_cutoff, nominations_close_at, voting_opens_at, voting_closes_at, term_months, certified_at, outcome, winning_candidate_id";

  let { data: election } = await supabase
    .from("elections")
    .select(ELECTION_COLUMNS)
    .eq("id", id)
    .is("cancelled_at", null)
    .maybeSingle();
  if (!election) notFound();

  // Settle the election on the first view after the deadline. There is no
  // scheduler in this project, and a result that waits for someone to
  // remember is not a result. certify_election is idempotent and only ever
  // counts votes already cast, so calling it from a render is safe - but
  // only call it when there is something to settle, and re-read afterwards
  // so this very visitor sees the outcome rather than "counting".
  if (votingHasClosed(election) && !election.certified_at) {
    await supabase.rpc("certify_election", { p_election_id: election.id });
    const { data: certified } = await supabase
      .from("elections")
      .select(ELECTION_COLUMNS)
      .eq("id", election.id)
      .maybeSingle();
    if (certified) election = certified;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: network }, { data: candidates }, { data: tally }, { data: roll }] =
    await Promise.all([
      supabase.from("networks").select("id, title").eq("id", election.network_id).maybeSingle(),
      supabase
        .from("election_candidates")
        .select("id, user_id, statement, ties, profile:user_id(first_name, last_name, username)")
        .eq("election_id", election.id)
        .is("withdrawn_at", null)
        .order("created_at"),
      // Counts come from a function so ballots stay unreadable while
      // totals are public (00000000000086).
      supabase.rpc("election_tally", { p_election_id: election.id }),
      supabase.rpc("election_roll", { p_election_id: election.id }),
    ]);

  const phase = phaseOf(election);
  const tallyFor = new Map(
    ((tally ?? []) as { candidate_id: number; votes_for: number; votes_against: number }[]).map(
      (row) => [row.candidate_id, row],
    ),
  );
  const rollRow = ((roll ?? []) as { roll_size: number; turnout: number }[])[0] ?? {
    roll_size: 0,
    turnout: 0,
  };

  // "On the roll" is not the same as "a member now": joining after
  // nominations opened lets you watch, not vote.
  const { data: membership } = user
    ? await supabase
        .from("network_members")
        .select("joined_at")
        .eq("network_id", election.network_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const onRoll = Boolean(
    membership && new Date(membership.joined_at as string) <= new Date(election.roll_cutoff),
  );

  const { data: myVote } = user
    ? await supabase
        .from("election_votes")
        .select("candidate_id")
        .eq("election_id", election.id)
        .eq("voter_id", user.id)
        .maybeSingle()
    : { data: null };

  const alreadyStanding = Boolean(
    user && (candidates ?? []).some((c) => c.user_id === user.id),
  );
  const singleCandidate = (candidates ?? []).length === 1;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/outposts/elections" className="text-sm text-muted underline hover:text-primary">
          ← {t("backToElections")}
        </Link>
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {network?.title ?? `#${election.network_id}`}
        </h1>
        <p className="text-body">{t("roleFull")}</p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-primary-light/40 p-4">
        <h2 className="text-sm font-medium text-ink">{t("shareHeading")}</h2>
        <p className="text-sm text-body">{t("shareBody")}</p>
        <ShareLink
          path={`/outposts/elections/${election.id}`}
          title={t("metaTitle", { network: network?.title ?? `#${election.network_id}` })}
          className="pt-1"
        />
      </section>

      {error && <FormError>{error}</FormError>}

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium text-ink">{t(`phase.${phase}`)}</p>
        <p className="text-muted">
          {t("nominationsClose")} <LocalDateTime iso={election.nominations_close_at} />
        </p>
        <p className="text-muted">
          {t("votingWindow")} <LocalDateTime iso={election.voting_opens_at} /> –{" "}
          <LocalDateTime iso={election.voting_closes_at} />
        </p>
        {/* Published on every election, not just the flattering ones: a
            mandate from 3 of 400 should read as thin rather than as
            authority. */}
        <p className="text-muted">
          {t("rollLine", { roll: rollRow.roll_size, turnout: rollRow.turnout })}
        </p>
        {/* A shared link mostly reaches people who are not members yet, so
            the frozen roll has to be explained before they sign up. Without
            this, forwarding the link reliably produces someone who joins,
            tries to vote, and is told no. */}
        {!onRoll && phase !== "closed" && (
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <p className="text-muted">
              {t.rich("rollExplainer", {
                // Rendered client-side in the reader's own timezone, same
                // as every other date on this page.
                cutoff: () => <LocalDateTime iso={election!.roll_cutoff} />,
              })}
            </p>
            <Link href={`/networks/${election.network_id}`} className="text-primary underline">
              {t("joinToTakePart")}
            </Link>
          </div>
        )}
      </section>

      {phase === "closed" && (
        <section className="rounded-lg border border-border bg-primary-light/40 p-4">
          <p className="font-medium text-ink">
            {election.outcome ? t(`outcome.${election.outcome}`) : t("outcome.counting")}
          </p>
          {election.outcome === "elected" && (
            <p className="mt-1 text-sm text-body">{t("outcomeTerm", { months: election.term_months })}</p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-ink">{t("candidates")}</h2>
        {(candidates ?? []).length === 0 && <p className="text-sm text-muted">{t("noCandidates")}</p>}

        {(candidates ?? []).map((candidate) => {
          const profile = candidate.profile as unknown as Author | null;
          const counts = tallyFor.get(candidate.id as number);
          const isMine = myVote?.candidate_id === candidate.id;
          return (
            <div key={candidate.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="font-medium text-ink">
                {profile ? getDisplayName(profile) : t("someone")}
              </p>
              <p className="text-sm text-body">{candidate.statement}</p>
              {candidate.ties && (
                <p className="text-sm text-muted">
                  {t("tiesLabel")} {candidate.ties}
                </p>
              )}

              {(phase === "voting" || phase === "closed") && counts && (
                <p className="text-sm text-muted tabular-nums">
                  {singleCandidate
                    ? t("confirmTally", { yes: counts.votes_for, no: counts.votes_against })
                    : t("tally", { votes: counts.votes_for })}
                </p>
              )}

              {phase === "voting" && user && onRoll && !myVote && (
                <form action={castVote} className="flex gap-2">
                  <input type="hidden" name="electionId" value={election.id} />
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  {singleCandidate ? (
                    <>
                      <SubmitButton name="support" value="yes">{t("voteYes")}</SubmitButton>
                      <SubmitButton name="support" value="no">{t("voteNo")}</SubmitButton>
                    </>
                  ) : (
                    <SubmitButton>{t("voteFor")}</SubmitButton>
                  )}
                </form>
              )}
              {election.winning_candidate_id === candidate.id && (
                <p className="text-sm font-medium text-primary">{t("winner")}</p>
              )}
              {isMine && <p className="text-sm text-primary">{t("yourVote")}</p>}
            </div>
          );
        })}
      </section>

      {phase === "nominating" && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-medium text-ink">{t("standTitle")}</h2>
          {!user ? (
            <Link href={`/sign-in?returnTo=/outposts/elections/${election.id}`} className="text-sm text-primary underline">
              {t("signInToStand")}
            </Link>
          ) : alreadyStanding ? (
            <p className="text-sm text-muted">{t("alreadyStanding")}</p>
          ) : !onRoll ? (
            <p className="text-sm text-muted">{t("notOnRoll")}</p>
          ) : (
            <form action={nominate} className="flex flex-col gap-3">
              <input type="hidden" name="electionId" value={election.id} />
              <Field>
                <Label htmlFor="statement">{t("statementLabel")}</Label>
                <Textarea id="statement" name="statement" required rows={4} />
              </Field>
              <Field>
                <Label htmlFor="ties">{t("tiesFieldLabel")}</Label>
                <Input id="ties" name="ties" />
              </Field>
              <SubmitButton className="self-start">{t("standSubmit")}</SubmitButton>
            </form>
          )}
        </section>
      )}

      <p className="text-sm text-muted">{t("scopeNote")}</p>
    </div>
  );
}
