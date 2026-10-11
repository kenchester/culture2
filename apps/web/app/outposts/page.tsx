import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Outpost directory — CultureMesh",
};

type Row = {
  principalName: string;
  principalKind: string;
  hostName: string;
  hostId: number;
  networkId: number;
  members: number;
  posts: number;
  status: string | null;
  officer: string | null;
};

/**
 * The outpost directory, and mostly the gaps in it.
 *
 * A consulate represents one place to another place. "People from X living
 * in Y" is exactly the population a mission in Y for X would serve, so the
 * site's place-origin networks are already consular districts - this page
 * just names them as such and says who, if anyone, is there.
 *
 * The point of the page is the absences. Representation is scarce because
 * a physical mission costs millions a year, so the honest default for
 * nearly every row is nobody, and showing that plainly is the argument.
 */
export default async function OutpostsPage() {
  const t = await getTranslations("outposts");
  const supabase = await createClient();

  const [{ data: principals }, { data: networks }, { data: outposts }] = await Promise.all([
    supabase.from("principals").select("id, name, kind, place_id"),
    supabase
      .from("networks")
      .select("id, origin_place_id, location_place_id, member_count, post_count")
      .not("origin_place_id", "is", null),
    supabase.from("outposts").select("id, principal_id, host_place_id, status, kind, heritage_note"),
  ]);

  const hostIds = [...new Set((networks ?? []).map((n) => n.location_place_id as number))];
  const { data: hostPlaces } = hostIds.length
    ? await supabase.from("places").select("id, name").in("id", hostIds)
    : { data: [] };

  // Officers are shown by name where an outpost has one, since "who is the
  // consul" is half of what a directory is for.
  const outpostIds = (outposts ?? []).map((o) => o.id as number);
  const { data: officers } = outpostIds.length
    ? await supabase
        .from("outpost_officers")
        .select("outpost_id, title, role, profile:user_id(first_name, last_name, username)")
        .in("outpost_id", outpostIds)
    : { data: [] };

  const hostById = new Map((hostPlaces ?? []).map((p) => [p.id as number, p.name as string]));
  const principalByPlace = new Map(
    (principals ?? []).filter((p) => p.place_id).map((p) => [p.place_id as number, p]),
  );
  const outpostFor = new Map(
    (outposts ?? []).map((o) => [`${o.principal_id}:${o.host_place_id}`, o]),
  );
  const officerFor = new Map(
    (officers ?? []).map((o) => {
      const p = o.profile as unknown as {
        first_name: string | null;
        last_name: string | null;
        username: string | null;
      } | null;
      const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username : null;
      return [o.outpost_id as number, (o.title as string | null) ?? name];
    }),
  );

  const rows: Row[] = [];
  for (const network of networks ?? []) {
    const principal = principalByPlace.get(network.origin_place_id as number);
    const hostName = hostById.get(network.location_place_id as number);
    if (!principal || !hostName) continue;
    const outpost = outpostFor.get(`${principal.id}:${network.location_place_id}`);
    rows.push({
      principalName: principal.name as string,
      principalKind: principal.kind as string,
      hostName,
      hostId: network.location_place_id as number,
      networkId: network.id as number,
      members: (network.member_count as number) ?? 0,
      posts: (network.post_count as number) ?? 0,
      status: (outpost?.status as string | undefined) ?? null,
      officer: outpost ? (officerFor.get(outpost.id as number) ?? null) : null,
    });
  }

  // Largest unserved population first: the directory is an argument, and
  // the argument is strongest at the top.
  rows.sort((a, b) => b.members - a.members || a.principalName.localeCompare(b.principalName));

  const represented = rows.filter((r) => r.status === "accredited").length;
  const historical = (outposts ?? []).filter((o) => o.status === "historical");
  const historicalPrincipal = new Map((principals ?? []).map((p) => [p.id as number, p.name as string]));
  const { data: historicalHosts } = historical.length
    ? await supabase
        .from("places")
        .select("id, name")
        .in("id", historical.map((o) => o.host_place_id as number))
    : { data: [] };
  const historicalHostById = new Map((historicalHosts ?? []).map((p) => [p.id as number, p.name as string]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("title")}
        </h1>
        <p className="text-body">{t("intro")}</p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {[
          { value: rows.length, label: t("stats.districts") },
          { value: represented, label: t("stats.represented") },
          { value: rows.length - represented, label: t("stats.unrepresented") },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="font-display text-2xl text-ink tabular-nums">{stat.value}</p>
            <p className="text-sm text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("tableTitle")}</h2>
        <p className="text-sm text-muted">{t("tableNote")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">{t("col.from")}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t("col.in")}</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">{t("col.people")}</th>
                <th scope="col" className="py-2 font-medium">{t("col.presence")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.principalName}-${row.networkId}`} className="border-b border-border">
                  <td className="py-2 pr-4 text-ink">{row.principalName}</td>
                  <td className="py-2 pr-4 text-body">
                    <Link href={`/networks/${row.networkId}`} className="underline hover:text-primary">
                      {row.hostName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right text-body tabular-nums">{row.members}</td>
                  <td className="py-2">
                    {row.status === "accredited" ? (
                      <span className="text-primary">{row.officer ?? t("presence.accredited")}</span>
                    ) : row.status ? (
                      <span className="text-muted">{t(`presence.${row.status}`)}</span>
                    ) : (
                      <span className="text-muted">{t("presence.none")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-muted">{t("empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {historical.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-ink">{t("historicalTitle")}</h2>
          <p className="text-sm text-muted">{t("historicalNote")}</p>
          {historical.map((outpost) => (
            <div key={outpost.id} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-medium text-ink">
                {historicalPrincipal.get(outpost.principal_id as number)} —{" "}
                {historicalHostById.get(outpost.host_place_id as number)}
              </p>
              {outpost.heritage_note && (
                <p className="mt-1 text-sm text-body">{outpost.heritage_note}</p>
              )}
            </div>
          ))}
        </section>
      )}

      <p className="text-sm text-muted">{t("footnote")}</p>
    </div>
  );
}
