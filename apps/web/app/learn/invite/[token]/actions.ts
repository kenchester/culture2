"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs via the admin client since validating a bare token has to work
// regardless of whether the accepting account is an org admin yet (it
// isn't, that's the whole point) - same bypass-RLS-by-design precedent as
// the whitelist-claim flow.
export async function acceptOrganizationInvite(formData: FormData) {
  const token = formData.get("token") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("organization_admin_invites")
    .select("id, organization_id, email, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite link isn't valid.")}`);
  }
  if (invite.accepted_at) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite has already been accepted.")}`);
  }
  if (new Date(invite.expires_at) < new Date()) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite has expired.")}`);
  }
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent(
        `This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
      )}`,
    );
  }

  const { error: adminError } = await admin
    .from("organization_admins")
    .insert({ organization_id: invite.organization_id, user_id: user.id, granted_by: null });

  if (adminError) {
    redirect(`/invite/${token}?error=${encodeURIComponent(adminError.message)}`);
  }

  await admin
    .from("organization_admin_invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const { data: org } = await admin
    .from("organizations")
    .select("slug")
    .eq("id", invite.organization_id)
    .single();

  redirect(org ? `/learn/${org.slug}/admin` : "/learn");
}
