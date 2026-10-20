import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Traffic — CultureMesh", robots: { index: false } };

type Row = { path: string; day: string; views: number };

// The clock has to be read outside render, same rule as the election
// phases (react-hooks/purity).
function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * What is actually being looked at.
 *
 * Everything built this month rests on the bet that reference pages are
 * worth landing on before anybody has joined. This is the only way to
 * find out, and until now there was no measurement of any kind - which
 * made "nobody came" and "we cannot tell" indistinguishable.
 *
 * Reads with the admin client because page_views has no select policy:
 * the counts are aggregate and identify nobody, but there is no reason
 * for them to be public either. This page sits under the admin layout's
 * is_admin gate.
 */
export default async function TrafficPage() {
  const admin = createAdminClient();
  const since = thirtyDaysAgo();

  const { data } = await admin
    .from("page_views")
    .select("path, day, views")
    .gte("day", since)
    .order("day", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as Row[];

  // By route shape, so the question "do corridor pages work at all"
  // is answerable before the question "which corridor".
  const byKind = new Map<string, number>();
  const byPage = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const kind = row.path.split(":")[0];
    byKind.set(kind, (byKind.get(kind) ?? 0) + row.views);
    byPage.set(row.path, (byPage.get(row.path) ?? 0) + row.views);
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.views);
  }
  const sorted = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]);

  const total = rows.reduce((sum, row) => sum + row.views, 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-ink">Last 30 days</h2>
        <p className="text-sm text-muted">
          Paths and daily counts only — no IP addresses, cookies, sessions or referrers are
          recorded, so this cannot say who visited, only what was read.
        </p>
        <p className="text-2xl text-ink tabular-nums">{total.toLocaleString()} views</p>
        {rows.length === 0 && (
          <p className="text-sm text-muted">
            Nothing recorded yet. Counting started when this was deployed, so a reading of zero
            before then means no data rather than no visitors.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-ink">By kind of page</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {sorted(byKind).map(([kind, views]) => (
              <tr key={kind} className="border-b border-border">
                <td className="py-1 pr-4 text-body">{kind}</td>
                <td className="py-1 text-right text-ink tabular-nums">{views.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-ink">Most read</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {sorted(byPage).slice(0, 40).map(([path, views]) => (
              <tr key={path} className="border-b border-border">
                <td className="break-all py-1 pr-4 text-body">{path}</td>
                <td className="py-1 text-right text-ink tabular-nums">{views.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-ink">By day</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {[...byDay.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([day, views]) => (
                <tr key={day} className="border-b border-border">
                  <td className="py-1 pr-4 text-body tabular-nums">{day}</td>
                  <td className="py-1 text-right text-ink tabular-nums">{views.toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
