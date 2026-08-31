import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveLearnSlugForEmail } from "@/app/learn/actions";

// The bare learn.culturemesh.com root - never a page of its own. Resolution
// order:
//   1. Signed in, recognized at a real (non-example) school, last active
//      there (profiles.last_learn_organization_id, kept current by
//      lib/organization-whitelist.ts on every /learn/[slug] visit) -> that
//      school.
//   2. Signed in, recognized at a real school but no visit recorded yet
//      (organization_whitelist.claimed_by) - the most recently claimed one.
//      Covers both "recognized at exactly one school" and "recognized at
//      several, never yet visited any of them from this entry point" -
//      either way, never surface a "choose your school" picker here; that
//      only exists behind the nav's "Schools" item (app/schools/page.tsx)
//      for someone who deliberately wants to switch.
//   3. Signed in under an email whose domain matches a school, but with no
//      organization_whitelist row at all yet - true first-ever visit,
//      landing straight at this bare root before claimWhitelistSeat has
//      ever run for them. Self-healing: once they land on that school's
//      page, claimWhitelistSeat runs and cases 1/2 take over from here on.
//   4. Everyone else (signed out, or signed in with no real-school
//      recognition at all) - the example org, exactly as an anonymous
//      visitor has always seen.
export default async function LearnRootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_learn_organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.last_learn_organization_id) {
      const { data: lastOrg } = await supabase
        .from("organizations")
        .select("slug, is_example")
        .eq("id", profile.last_learn_organization_id)
        .maybeSingle();
      if (lastOrg && !lastOrg.is_example) {
        redirect(`/learn/${lastOrg.slug}`);
      }
    }

    const { data: claims } = await supabase
      .from("organization_whitelist")
      .select("claimed_at, organization:organizations(slug, is_example)")
      .eq("claimed_by", user.id)
      .order("claimed_at", { ascending: false });
    type ClaimRow = { organization: { slug: string; is_example: boolean } | null };
    const realClaim = ((claims ?? []) as unknown as ClaimRow[]).find(
      (c) => c.organization && !c.organization.is_example,
    );
    if (realClaim?.organization) {
      redirect(`/learn/${realClaim.organization.slug}`);
    }

    if (user.email) {
      const ownSlug = await resolveLearnSlugForEmail(user.email);
      if (ownSlug) {
        const { data: matchedOrg } = await supabase
          .from("organizations")
          .select("is_example")
          .eq("slug", ownSlug)
          .maybeSingle();
        if (matchedOrg && !matchedOrg.is_example) {
          redirect(`/learn/${ownSlug}`);
        }
      }
    }
  }

  redirect("/learn/acme-university");
}
