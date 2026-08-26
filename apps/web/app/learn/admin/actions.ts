"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const ROLES = ["student", "instructor", "admin"];

// Whitelisting is the DB write that actually matters - it's what
// app/learn/whitelist.ts's claim flow looks for the moment this person
// next signs in. The notification email is a courtesy on top, so a
// delivery failure (bad address, Resend hiccup) doesn't undo the
// whitelisting itself.
export async function whitelistMember(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;
  const languageIds = formData.getAll("languageIds").map(Number).filter((id) => !Number.isNaN(id));

  if (!email || !ROLES.includes(role)) {
    redirect(`/admin?error=${encodeURIComponent("A valid email and role are required.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: org } = await supabase.from("organizations").select("name").eq("id", organizationId).single();

  const { error } = await supabase.from("organization_whitelist").insert({
    organization_id: organizationId,
    email,
    role,
    language_ids: languageIds,
    invited_by: user?.id,
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  try {
    const { data: languages } = await supabase.from("languages").select("name").in("id", languageIds);
    const languageNames = (languages ?? []).map((l) => l.name).join(", ");
    await sendEmail({
      to: email,
      subject: `You're in - ${org?.name ?? "your program"} on CultureMesh`,
      text: `You've been added to ${org?.name ?? "your program"} on CultureMesh${
        languageNames ? ` and enrolled in: ${languageNames}` : ""
      }. Sign in with this email to get started.`,
    });
  } catch {
    // Best-effort - the whitelist row above is what actually grants
    // access, so a failed notification shouldn't look like a failed action.
  }

  revalidatePath("/admin");
  redirect(`/admin?success=${encodeURIComponent(`${email} whitelisted.`)}`);
}

// A per-person, explicit action - there's no automatic end-of-semester
// removal. Revokes both the whitelist entry and (if already claimed) their
// seat in this org's networks; runs via the admin client since removing
// someone ELSE's network_members row isn't something the "leave a network
// you joined" self-serve RLS policy permits.
export async function removeWhitelistedMember(formData: FormData) {
  const whitelistId = Number(formData.get("whitelistId"));

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("organization_whitelist")
    .select("organization_id, claimed_by")
    .eq("id", whitelistId)
    .single();

  if (!entry) {
    redirect(`/admin?error=${encodeURIComponent("Whitelist entry not found.")}`);
  }

  if (entry.claimed_by) {
    const admin = createAdminClient();
    const { data: orgNetworks } = await admin
      .from("organization_languages")
      .select("network_id")
      .eq("organization_id", entry.organization_id);
    const networkIds = (orgNetworks ?? []).map((n) => n.network_id);
    if (networkIds.length > 0) {
      await admin.from("network_members").delete().eq("user_id", entry.claimed_by).in("network_id", networkIds);
    }
  }

  const { error } = await supabase.from("organization_whitelist").delete().eq("id", whitelistId);
  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  redirect(`/admin?success=${encodeURIComponent("Member removed.")}`);
}
