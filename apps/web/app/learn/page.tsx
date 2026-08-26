import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DomainCheckBanner } from "@/app/learn/domain-check-banner";
import { LearnSearchForm } from "@/app/learn/learn-search-form";

type OrgLanguageRow = {
  language: { name: string } | null;
  network: { id: number; title: string; member_count: number; post_count: number } | null;
};

// The public landing page for learn.culturemesh.com - reachable by anyone,
// no sign-in required. "Whitelist-gated" governs joining/posting in the
// example networks below (see the restrictive network_members policy in
// 00000000000043_organizations.sql), not browsing them - posts and
// networks are publicly readable everywhere on this site by design, which
// is exactly what makes "see example networks below" a real, working demo
// rather than a locked door.
export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ domainMatch?: string; domainNoMatch?: string; domainError?: string }>;
}) {
  const { domainMatch, domainNoMatch, domainError } = await searchParams;
  const t = await getTranslations("learn");
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("subdomain", "learn")
    .maybeSingle();

  const { data: orgLanguages } = org
    ? await supabase
        .from("organization_languages")
        .select("language:languages(name), network:networks(id, title, member_count, post_count)")
        .eq("organization_id", org.id)
    : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-ink">
            {org ? t("heading", { name: org.name }) : t("misconfigured")}
          </h1>
          <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
            {t("exampleNetworkBadge")}
          </span>
        </div>
        <p className="mt-2 text-body">{t("intro")}</p>
      </div>

      <DomainCheckBanner domainMatch={domainMatch} domainNoMatch={domainNoMatch} domainError={domainError} />

      {!org ? (
        <p className="text-sm text-error">{t("misconfigured")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-ink">{t("findYourLanguageHeading")}</h2>
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
            <LearnSearchForm organizationId={org.id} />
          </div>
          <h2 className="font-display text-xl text-ink">{t("exampleNetworksHeading")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {((orgLanguages ?? []) as unknown as OrgLanguageRow[]).map((row) =>
              row.network && row.language ? (
                <Link
                  key={row.network.id}
                  href={`/networks/${row.network.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
                >
                  <span className="font-medium text-ink">{row.language.name}</span>
                  <span className="text-sm text-muted">
                    {t("memberPostCounts", {
                      members: row.network.member_count,
                      posts: row.network.post_count,
                    })}
                  </span>
                </Link>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}
