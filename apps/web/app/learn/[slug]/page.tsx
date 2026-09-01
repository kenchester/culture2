import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildSubdomainUrl, getMainSiteUrl, isLearnHost } from "@/lib/site-url";
import { DomainCheckBanner } from "@/app/learn/domain-check-banner";
import { GetStartedBanner } from "@/app/learn/get-started-banner";
import { VerifySchoolEmailForm } from "@/app/learn/verify-school-email-form";
import { AddSchoolLink } from "@/app/learn/add-school-link";
import { LearnSearchForm } from "@/app/learn/learn-search-form";
import { LaunchNetworkForm } from "@/app/learn/[slug]/launch-network-form";

type OrgLanguageRow = {
  language: { name: string } | null;
  network: { id: number; title: string; member_count: number; post_count: number } | null;
};

// A school's public landing page under learn.culturemesh.com/{slug} -
// reachable by anyone, no sign-in required. "Whitelist-gated" governs
// joining/posting in the example networks below (see the restrictive
// network_members policy in 00000000000043_organizations.sql), not browsing
// them - posts and networks are publicly readable everywhere on this site by
// design, which is exactly what makes "see example networks below" a real,
// working demo rather than a locked door.
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    domainMatch?: string;
    domainNoMatch?: string;
    domainError?: string;
    error?: string;
    verifyEmail?: string;
    verifyError?: string;
    addSchoolNoMatch?: string;
    addSchoolError?: string;
  }>;
}) {
  const { slug } = await params;
  const {
    domainMatch,
    domainNoMatch,
    domainError,
    error,
    verifyEmail,
    verifyError,
    addSchoolNoMatch,
    addSchoolError,
  } = await searchParams;

  // Every /learn/{slug} page belongs on learn.culturemesh.com, full stop -
  // unlike a network (which may or may not be campus-anchored), there's no
  // such thing as a "public, non-learn" org page, so this canonicalizes
  // unconditionally rather than branching on is_example. Symmetric with
  // the opposite-direction redirect on /networks/[id] (a non-campus
  // network visited on the learn host bounces back to the plain site) -
  // without this, a relative link built while browsing the plain host
  // (e.g. app/schools/page.tsx's school list) would otherwise render this
  // page under the wrong host instead of bouncing to the right one.
  // Skipped locally: no real subdomain to redirect to there, and
  // buildSubdomainUrl's own localhost fallback would otherwise send this
  // right back to the same URL and loop.
  const mainSiteUrl = await getMainSiteUrl();
  const isLocalDev = mainSiteUrl.includes("localhost") || mainSiteUrl.includes("127.0.0.1");
  if (!isLocalDev && !(await isLearnHost())) {
    const params = new URLSearchParams();
    if (domainMatch) params.set("domainMatch", domainMatch);
    if (domainNoMatch) params.set("domainNoMatch", domainNoMatch);
    if (domainError) params.set("domainError", domainError);
    if (error) params.set("error", error);
    if (verifyEmail) params.set("verifyEmail", verifyEmail);
    if (verifyError) params.set("verifyError", verifyError);
    if (addSchoolNoMatch) params.set("addSchoolNoMatch", addSchoolNoMatch);
    if (addSchoolError) params.set("addSchoolError", addSchoolError);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    redirect(buildSubdomainUrl(mainSiteUrl, "learn", `/learn/${slug}${query}`));
  }

  const t = await getTranslations("learn");
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, domain, is_example")
    .eq("slug", slug)
    .maybeSingle();

  const { data: orgLanguages } = org
    ? await supabase
        .from("organization_languages")
        .select("language:languages(name), network:networks(id, title, member_count, post_count)")
        .eq("organization_id", org.id)
    : { data: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Recognized via matching email domain (lib/organization-whitelist.ts)
  // but not yet assigned a language by the org admin - language_ids is an
  // empty array, not a missing row.
  const [{ data: pendingEntry }, { data: adminMembership }] =
    org && user
      ? await Promise.all([
          supabase
            .from("organization_whitelist")
            .select("language_ids")
            .eq("organization_id", org.id)
            .eq("claimed_by", user.id)
            .maybeSingle(),
          supabase
            .from("organization_admins")
            .select("user_id")
            .eq("organization_id", org.id)
            .eq("user_id", user.id)
            .maybeSingle(),
        ])
      : [{ data: null }, { data: null }];
  const isPending = Boolean(pendingEntry && pendingEntry.language_ids.length === 0);
  // Whether this visitor can launch a network for a not-yet-offered
  // language (LaunchNetworkForm below) - either an org admin, or already
  // recognized as belonging to this school at all (claimWhitelistSeat in
  // app/learn/[slug]/layout.tsx already ran this request).
  const isRecognizedMember = Boolean(pendingEntry) || Boolean(adminMembership);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ink sm:whitespace-nowrap">
            {org ? t("heading", { name: org.name }) : t("misconfigured")}
          </h1>
          {org?.is_example && (
            <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
              {t("exampleNetworkBadge")}
            </span>
          )}
        </div>
        <p className="mt-2 text-body">{t("intro")}</p>
      </div>

      {org?.is_example ? (
        <DomainCheckBanner
          slug={slug}
          domainMatch={domainMatch}
          domainNoMatch={domainNoMatch}
          domainError={domainError}
        />
      ) : org && !isRecognizedMember ? (
        !user ? (
          <GetStartedBanner slug={slug} orgName={org.name} domain={org.domain} />
        ) : (
          // Signed in, but under an identity this org doesn't recognize -
          // their main CultureMesh account, or one tied to a different
          // school. Routing them through sign-in/register again would be
          // confusing since they can see they're already logged in; this
          // proves they also control a school email and adds it to their
          // current profile instead (verifyEmailCode in
          // app/learn/[slug]/actions.ts), no new account involved.
          <VerifySchoolEmailForm
            organizationId={org.id}
            slug={slug}
            orgName={org.name}
            domain={org.domain}
            pendingEmail={verifyEmail}
            error={verifyError}
          />
        )
      ) : null}

      {isPending && org && (
        // Success-green, not primary-tinted: this is good news ("you're
        // recognized"), and on the Campus Zine theme primary-light is a
        // pale pink that reads as a warning/error rather than a helpful
        // heads-up.
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {t("pendingNotice", { name: org.name })}
        </p>
      )}

      {!org ? (
        <p className="text-sm text-error">{t("misconfigured")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {org.is_example ? (
            <>
              <h2 className="font-display text-xl text-ink">{t("findYourLanguageHeading")}</h2>
              <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
                <LearnSearchForm organizationId={org.id} />
              </div>
            </>
          ) : (
            isRecognizedMember && (
              <>
                <h2 className="font-display text-xl text-ink">{t("launchNetworkHeading")}</h2>
                {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
                <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
                  <LaunchNetworkForm organizationId={org.id} slug={slug} />
                </div>
              </>
            )
          )}
          <h2 className="font-display text-xl text-ink">
            {org.is_example
              ? t("exampleNetworksHeading", { name: org.name })
              : t("currentNetworksHeading", { name: org.name })}
          </h2>
          <p className="text-sm text-muted">{t("exampleNetworksIntro")}</p>
          {!org.is_example && (orgLanguages ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t("currentNetworksEmpty")}</p>
          ) : (
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
          )}
        </div>
      )}

      {org && !org.is_example && (
        <AddSchoolLink slug={slug} noMatchDomain={addSchoolNoMatch} error={addSchoolError} />
      )}

      {/* Every /learn/{slug} page gets this, not just Acme's example one -
          someone already signed in and recognized at their own real
          school (e.g. MSU) still has no way to reach the pitch page
          without leaving the learn.culturemesh.com context (and, since
          they're already recognized, they'd never naturally land on
          Acme's page to find it there). */}
      {org && (
        <Link
          href="/learn/educators"
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-5 py-2.5 text-base font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Why CultureMesh Learn?
        </Link>
      )}
    </div>
  );
}
