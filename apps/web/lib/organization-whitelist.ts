import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// Runs on every authenticated request under /learn - the whole point is
// that whitelisting can happen before OR after someone has an account, so
// this has to check on every visit rather than only at sign-up. Cheap when
// there's nothing to claim: a single indexed lookup that comes back empty.
// Goes through the admin client throughout, same as the invite-accept
// flow - this is the one path allowed to insert into an org-gated
// network's network_members (see the restrictive policy in
// 00000000000043_organizations.sql) and into organization_admins.
export async function claimWhitelistSeat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return;
  }

  const admin = createAdminClient();
  const email = user.email.toLowerCase();

  const { data: org } = await admin
    .from("organizations")
    .select("id, domain, domain_signin_enabled")
    .eq("subdomain", "learn")
    .maybeSingle();
  if (!org) {
    return;
  }

  const { data: entry } = await admin
    .from("organization_whitelist")
    .select("id, role, language_ids, claimed_by")
    .eq("organization_id", org.id)
    .eq("email", email)
    .maybeSingle();

  if (entry) {
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
  if (org.domain_signin_enabled && org.domain) {
    const emailDomain = email.split("@")[1];
    if (emailDomain === org.domain) {
      await admin.from("organization_whitelist").insert({
        organization_id: org.id,
        email,
        role: "student",
        language_ids: [],
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        invited_by: null,
      });
    }
  }
}
