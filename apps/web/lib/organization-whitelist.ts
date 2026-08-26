import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: org } = await admin.from("organizations").select("id").eq("subdomain", "learn").maybeSingle();
  if (!org) {
    return;
  }

  const { data: entry } = await admin
    .from("organization_whitelist")
    .select("id, role, language_ids")
    .eq("organization_id", org.id)
    .eq("email", email)
    .is("claimed_by", null)
    .maybeSingle();

  if (!entry) {
    return;
  }

  if (entry.language_ids.length > 0) {
    const { data: orgLanguages } = await admin
      .from("organization_languages")
      .select("network_id")
      .eq("organization_id", org.id)
      .in("language_id", entry.language_ids);

    const networkIds = (orgLanguages ?? []).map((l) => l.network_id);
    if (networkIds.length > 0) {
      await admin
        .from("network_members")
        .upsert(
          networkIds.map((networkId) => ({ network_id: networkId, user_id: user.id })),
          { onConflict: "network_id,user_id", ignoreDuplicates: true },
        );
    }
  }

  if (entry.role === "admin") {
    await admin
      .from("organization_admins")
      .upsert({ organization_id: org.id, user_id: user.id }, { onConflict: "organization_id,user_id", ignoreDuplicates: true });
  }

  await admin
    .from("organization_whitelist")
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", entry.id);
}
