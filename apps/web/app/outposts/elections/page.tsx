import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { openElection } from "@/app/outposts/elections/actions";
import { FormError } from "@/components/ui/form-error";
import { Field, fieldClass, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = {
  title: "Consul elections — CultureMesh",
};

function phaseOf(e: { nominations_close_at: string; voting_opens_at: string; voting_closes_at: string }) {
  const now = Date.now();
  if (now < new Date(e.nominations_close_at).getTime()) return "nominating";
  if (now < new Date(e.voting_opens_at).getTime()) return "pending";
  if (now < new Date(e.voting_closes_at).getTime()) return "voting";
  return "closed";
}

/**
 * Elections for the Unofficial Consul of a from -> to pairing.
 *
 * An election can only be opened by someone already in the network, which
 * is the cheapest honest gate against elections being started for
 * communities the opener has nothing to do with - and it needs no
 * moderation queue. The select below is therefore populated only with the
 * viewer's own place-to-place networks.
 */
export default async function ElectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("elections");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: elections } = await supabase
    .from("elections")
    .select("id, network_id, nominations_close_at, voting_opens_at, voting_closes_at, term_months")
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });

  const networkIds = [...new Set((elections ?? []).map((e) => e.network_id as number))];
  const { data: networks } = networkIds.length
    ? await supabase.from("networks").select("id, title").in("id", networkIds)
    : { data: [] };
  const titleById = new Map((networks ?? []).map((n) => [n.id as number, n.title as string]));

  // Networks this person belongs to that could hold the office at all: a
  // consul represents a place to a place, so language-origin networks are
  // excluded outright.
  const { data: myMemberships } = user
    ? await supabase.from("network_members").select("network_id").eq("user_id", user.id)
    : { data: null };
  const myIds = (myMemberships ?? []).map((m) => m.network_id as number);
  const { data: eligible } = myIds.length
    ? await supabase
        .from("networks")
        .select("id, title, origin_place_id, location_place_id")
        .in("id", myIds)
        .not("origin_place_id", "is", null)
    : { data: [] };

  // A network sitting on a hidden place - an organisation anchor, or a
  // test geography - should no more appear here than in search. The
  // outposts directory already applies this; the dropdown queries networks
  // directly, so it has to apply it too rather than inherit it.
  const placeIds = [
    ...new Set((eligible ?? []).flatMap((n) => [n.origin_place_id, n.location_place_id])),
  ].filter(Boolean) as number[];
  const { data: visiblePlaces } = placeIds.length
    ? await supabase.from("places").select("id").in("id", placeIds).eq("hidden_from_search", false)
    : { data: [] };
  const visible = new Set((visiblePlaces ?? []).map((p) => p.id as number));

  const alreadyRunning = new Set((elections ?? []).map((e) => e.network_id as number));
  const openable = (eligible ?? []).filter(
    (n) =>
      !alreadyRunning.has(n.id as number) &&
      visible.has(n.origin_place_id as number) &&
      visible.has(n.location_place_id as number),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title")}
        </h1>
        <p className="text-body">{t("intro")}</p>
        <p className="text-sm text-muted">{t("historyNote")}</p>
      </header>

      {error && <FormError>{error}</FormError>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("openTitle")}</h2>
        {elections && elections.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {elections.map((e) => (
              <li key={e.id} className="rounded-lg border border-border bg-surface p-4">
                <Link
                  href={`/outposts/elections/${e.id}`}
                  className="font-medium text-ink underline hover:text-primary"
                >
                  {titleById.get(e.network_id as number) ?? `#${e.network_id}`}
                </Link>
                <p className="text-sm text-muted">{t(`phase.${phaseOf(e)}`)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("noneYet")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-ink">{t("startTitle")}</h2>
        <p className="text-sm text-body">{t("startBody")}</p>
        {!user ? (
          <Link href="/sign-in?returnTo=/outposts/elections" className="text-sm text-primary underline">
            {t("signInToStart")}
          </Link>
        ) : openable.length === 0 ? (
          <p className="text-sm text-muted">{t("noEligibleNetworks")}</p>
        ) : (
          <form action={openElection} className="flex flex-col gap-3">
            <Field>
              <Label htmlFor="networkId">{t("chooseNetwork")}</Label>
              <select id="networkId" name="networkId" required className={fieldClass} defaultValue="">
                <option value="" disabled>
                  {t("chooseNetworkPlaceholder")}
                </option>
                {openable.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton className="self-start">{t("startSubmit")}</SubmitButton>
          </form>
        )}
      </section>

      <p className="text-sm text-muted">{t("scopeNote")}</p>
    </div>
  );
}
