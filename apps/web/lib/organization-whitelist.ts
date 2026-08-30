import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { domainMatchCandidates } from "@/lib/school-domain";

// Inserts network_members rows for each of an org's networks matching the
// given language_ids - shared between the sign-in-time whitelist claim
// below and the admin-driven "assign languages to a pending member"
// action (app/learn/admin/actions.ts), since both need the identical
// enrollment step, just triggered by different events. Upsert with
// ignoreDuplicates makes this safe to call again for languages someone's
// already enrolled in.
export async function enrollInLanguages(
  admin: SupabaseClient,
  organizationId: number,
  userId: string,
  languageIds: number[],
) {
  if (languageIds.length === 0) {
    return;
  }

  const { data: orgLanguages } = await admin
    .from("organization_languages")
    .select("network_id")
    .eq("organization_id", organizationId)
    .in("language_id", languageIds);

  const networkIds = (orgLanguages ?? []).map((l) => l.network_id);
  if (networkIds.length === 0) {
    return;
  }

  await admin
    .from("network_members")
    .upsert(
      networkIds.map((networkId) => ({ network_id: networkId, user_id: userId })),
      { onConflict: "network_id,user_id", ignoreDuplicates: true },
    );
}

// Runs on every authenticated request under /learn/[slug] - the whole point
// is that whitelisting can happen before OR after someone has an account, so
// this has to check on every visit rather than only at sign-up. Cheap when
// there's nothing to claim: a single indexed lookup that comes back empty.
// Goes through the admin client throughout, same as the invite-accept
// flow - this is the one path allowed to insert into an org-gated
// network's network_members (see the restrictive policy in
// 00000000000043_organizations.sql) and into organization_admins.
export async function claimWhitelistSeat(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return;
  }

  const admin = createAdminClient();

  // Someone can be recognized under an email that isn't the one they
  // signed in with - e.g. their sign-in identity is a personal gmail (or
  // an account tied to a school they've since left), but they've since
  // verified a school email onto this same profile
  // (app/learn/[slug]/actions.ts's verifyEmailCode). Every check below
  // tries all of them, not just the sign-in email.
  const { data: secondaryEmailRows } = await admin
    .from("verified_school_emails")
    .select("email")
    .eq("profile_id", user.id);
  const candidateEmails = [
    user.email.toLowerCase(),
    ...(secondaryEmailRows ?? []).map((r) => r.email),
  ];

  const { data: org } = await admin
    .from("organizations")
    .select("id, domain, domain_signin_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) {
    return;
  }

  for (const email of candidateEmails) {
    const { data: entry } = await admin
      .from("organization_whitelist")
      .select("id, role, language_ids, claimed_by")
      .eq("organization_id", org.id)
      .eq("email", email)
      .maybeSingle();

    if (!entry) {
      continue;
    }
    if (entry.claimed_by) {
      return;
    }

    await enrollInLanguages(admin, org.id, user.id, entry.language_ids);

    if (entry.role === "admin") {
      await admin
        .from("organization_admins")
        .upsert(
          { organization_id: org.id, user_id: user.id },
          { onConflict: "organization_id,user_id", ignoreDuplicates: true },
        );
    }

    await admin
      .from("organization_whitelist")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", entry.id);
    return;
  }

  // No whitelist row at all - not "invited yet", but a signed-in visitor
  // whose email domain matches the school's on-file domain gets recognized
  // as a member of the org (visible to its admin, ready to be assigned a
  // language) without needing to already be in a network. domain can be
  // set without domain_signin_enabled (a school might keep it on file for
  // the marketing banner's domain-check without wanting auto-recognition -
  // e.g. a small school that doesn't issue students institutional email).
  if (!org.domain_signin_enabled || !org.domain) {
    return;
  }

  const orgDomain = org.domain;
  const matchedEmail = candidateEmails.find((email) => {
    const emailDomain = email.split("@")[1];
    return emailDomain && domainMatchCandidates(emailDomain).includes(orgDomain);
  });
  if (!matchedEmail) {
    return;
  }

  // A self-serve org (app/learn/start) only ever has the one language it
  // was approved for - nothing for an admin to pick, so skip the pending
  // state and enroll immediately. A multi-language school (Acme) still
  // needs an admin to choose, since there's real ambiguity.
  const { data: orgLanguages } = await admin
    .from("organization_languages")
    .select("language_id")
    .eq("organization_id", org.id);
  const languageIds = orgLanguages?.length === 1 ? [orgLanguages[0].language_id] : [];

  await admin.from("organization_whitelist").insert({
    organization_id: org.id,
    email: matchedEmail,
    role: "student",
    language_ids: languageIds,
    claimed_by: user.id,
    claimed_at: new Date().toISOString(),
    invited_by: null,
  });

  if (languageIds.length > 0) {
    await enrollInLanguages(admin, org.id, user.id, languageIds);
  }
}

export type LearnAccess = {
  org: { id: number; name: string } | null;
  role: "admin" | "instructor" | null;
  languageIds: number[];
};

// Shared by app/learn/[slug]/admin/layout.tsx (the access gate) and page.tsx
// (content branching - org admins see everything, instructors see only
// their own language_ids). Two cheap, indexed lookups; re-run per request
// rather than threaded through as a prop, since Next.js doesn't share
// computed data between a layout and its page without a client-side
// context provider, which isn't worth the complexity here.
export async function getLearnAccess(slug: string): Promise<LearnAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!user || !org) {
    return { org: org ?? null, role: null, languageIds: [] };
  }

  const { data: adminMembership } = await supabase
    .from("organization_admins")
    .select("user_id")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminMembership) {
    return { org, role: "admin", languageIds: [] };
  }

  const { data: whitelistEntry } = await supabase
    .from("organization_whitelist")
    .select("language_ids")
    .eq("organization_id", org.id)
    .eq("claimed_by", user.id)
    .eq("role", "instructor")
    .maybeSingle();

  if (whitelistEntry) {
    return { org, role: "instructor", languageIds: whitelistEntry.language_ids };
  }

  return { org, role: null, languageIds: [] };
}
