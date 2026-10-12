import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Outposts — CultureMesh",
};

type Row = {
  principalName: string;
  hostName: string;
  networkId: number;
  members: number;
  consul: string | null;
  electionId: number | null;
  electionPhase: "nominating" | "voting" | "closed" | null;
};

function phaseOf(e: {
  nominations_close_at: string;
  voting_opens_at: string;
  voting_closes_at: string;
}): "nominating" | "voting" | "closed" {
  const now = Date.now();
  if (now < new Date(e.nominations_close_at).getTime()) return "nominating";
  if (now < new Date(e.voting_closes_at).getTime()) return "voting";
  return "closed";
}

/**
 * Outposts: the idea first, the data last.
 *
 * An earlier version opened with a table of every district, which at this
 * stage is thirty-odd rows with one member each - leading with the emptiest
 * thing on the page and burying the one genuinely interesting item (a real
 * consulate, closed for decades, with a live network standing where it
 * stood) at the bottom. The order is now: what this is, the case that
 * shows it, what you can do, and only then the map so far.
 */
export default async function OutpostsPage() {
  const t = await getTranslations("outposts");
  const supabase = await createClient();

  const [{ data: principals }, { data: networks }, { data: outposts }, { data: elections }] =
    await Promise.all([
      supabase.from("principals").select("id, name, kind, place_id"),
      supabase
        .from("networks")
        .select("id, origin_place_id, location_place_id, member_count")
        .not("origin_place_id", "is", null),
      supabase.from("outposts").select("id, principal_id, host_place_id, status, heritage_note"),
      supabase
        .from("elections")
        .select("id, network_id, nominations_close_at, voting_opens_at, voting_closes_at")
        .is("cancelled_at", null),
    ]);

  const placeIds = [
    ...new Set((networks ?? []).flatMap((n) => [n.origin_place_id, n.location_place_id])),
  ].filter(Boolean) as number[];
  // hidden_from_search is the one switch for "this place shouldn't surface"
  // - organisation anchors and test geographies alike.
  const { data: places } = placeIds.length
    ? await supabase.from("places").select("id, name").in("id", placeIds).eq("hidden_from_search", false)
    : { data: [] };
  const placeById = new Map((places ?? []).map((p) => [p.id as number, p.name as string]));

  const outpostIds = (outposts ?? []).map((o) => o.id as number);
  const { data: officers } = outpostIds.length
    ? await supabase
        .from("outpost_officers")
        .select("outpost_id, title, profile:user_id(first_name, last_name, username)")
        .in("outpost_id", outpostIds)
    : { data: [] };

  const principalByPlace = new Map(
    (principals ?? []).filter((p) => p.place_id).map((p) => [p.place_id as number, p]),
  );
  const outpostFor = new Map((outposts ?? []).map((o) => [`${o.principal_id}:${o.host_place_id}`, o]));
  const officerFor = new Map(
    (officers ?? []).map((o) => {
      const p = o.profile as unknown as {
        first_name: string | null;
        last_name: string | null;
        username: string | null;
      } | null;
      const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username : null;
      // Name first: every elected consul carries the same title, so the
      // title alone would make each row say the same thing.
      return [o.outpost_id as number, name ?? (o.title as string | null)];
    }),
  );
  const electionByNetwork = new Map((elections ?? []).map((e) => [e.network_id as number, e]));

  const rows: Row[] = [];
  for (const network of networks ?? []) {
    const principal = principalByPlace.get(network.origin_place_id as number);
    const hostName = placeById.get(network.location_place_id as number);
    const originName = placeById.get(network.origin_place_id as number);
    if (!principal || !hostName || !originName) continue;
    const outpost = outpostFor.get(`${principal.id}:${network.location_place_id}`);
    const election = electionByNetwork.get(network.id as number);
    rows.push({
      principalName: principal.name as string,
      hostName,
      networkId: network.id as number,
      members: (network.member_count as number) ?? 0,
      consul: outpost ? (officerFor.get(outpost.id as number) ?? null) : null,
      electionId: (election?.id as number | undefined) ?? null,
      electionPhase: election ? phaseOf(election) : null,
    });
  }
  rows.sort((a, b) => b.members - a.members || a.principalName.localeCompare(b.principalName));

  const historical = (outposts ?? []).filter((o) => o.status === "historical");
  const principalName = new Map((principals ?? []).map((p) => [p.id as number, p.name as string]));
  const principalPlace = new Map(
    (principals ?? []).map((p) => [p.id as number, p.place_id as number | null]),
  );
  const { data: historicalHosts } = historical.length
    ? await supabase
        .from("places")
        .select("id, name")
        .in("id", historical.map((o) => o.host_place_id as number))
    : { data: [] };
  const historicalHostName = new Map((historicalHosts ?? []).map((p) => [p.id as number, p.name as string]));
  // An outpost's network is derivable - principal place to host place is a
  // network's origin to location - so no stored link can drift.
  const networkFor = new Map(
    (networks ?? []).map((n) => [`${n.origin_place_id}:${n.location_place_id}`, n.id as number]),
  );

  const openElections = rows.filter((r) => r.electionPhase && r.electionPhase !== "closed").length;
  const consuls = rows.filter((r) => r.consul).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title")}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      {/* The hook, and the first thing anyone should see: a real consulate
          that closed, with a live community standing where it stood. */}
      {historical.map((outpost) => {
        const networkId = networkFor.get(
          `${principalPlace.get(outpost.principal_id as number)}:${outpost.host_place_id}`,
        );
        return (
          <section
            key={outpost.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{t("historicalTitle")}</p>
            <h2 className="font-display text-xl text-ink">
              {principalName.get(outpost.principal_id as number)} —{" "}
              {historicalHostName.get(outpost.host_place_id as number)}
            </h2>
            {outpost.heritage_note && <p className="text-body">{outpost.heritage_note}</p>}
            {networkId && (
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-ink">{t("reopenedLabel")}</p>
                <Link
                  href={`/networks/${networkId}`}
                  className="text-sm text-primary underline hover:text-primary"
                >
                  {t("reopenedLink")}
                </Link>
              </div>
            )}
          </section>
        );
      })}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-primary-light/40 p-6">
        <h2 className="font-display text-xl text-ink">{t("electTitle")}</h2>
        <p className="text-body">{t("electBody")}</p>
        <Link href="/outposts/elections" className="self-start text-primary underline">
          {t("electCta")}
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("districtsTitle")}</h2>
        <p className="text-sm text-muted tabular-nums">
          {t("districtsNote", { districts: rows.length, consuls, elections: openElections })}
        </p>
        <p className="text-sm text-muted">{t("districtsEarly")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">{t("col.district")}</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">{t("col.people")}</th>
                <th scope="col" className="py-2 font-medium">{t("col.presence")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.networkId} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <Link href={`/networks/${row.networkId}`} className="text-ink underline hover:text-primary">
                      {row.principalName} → {row.hostName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right text-body tabular-nums">{row.members}</td>
                  <td className="py-2">
                    {row.consul ? (
                      <span className="text-primary">{row.consul}</span>
                    ) : row.electionId && row.electionPhase !== "closed" ? (
                      <Link
                        href={`/outposts/elections/${row.electionId}`}
                        className="text-primary underline"
                      >
                        {t(`presence.${row.electionPhase}`)}
                      </Link>
                    ) : (
                      <span className="text-muted">{t("presence.none")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-muted">{t("empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-muted">{t("footnote")}</p>
    </div>
  );
}
