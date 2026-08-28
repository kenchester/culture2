"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendBulkEmails } from "@/lib/email";
import { enrollInLanguages } from "@/lib/organization-whitelist";

const ROLES = ["student", "instructor", "admin"];
const MAX_ROSTER_SIZE = 500;
// Unanchored, unlike app/networks/actions.ts's EMAIL_PATTERN (which
// validates a whole string) - this pulls email-shaped tokens out of
// messier free text (a pasted roster or an uploaded CSV/TXT file, extra
// columns, quoted names, commas and all), since there's no CSV-parsing
// library in this repo and school roster exports are too inconsistent to
// rely on delimiter position.
const EMAIL_EXTRACT_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

// Whitelisting is the DB write that actually matters - it's what
// lib/organization-whitelist.ts's claim flow looks for the moment this
// person next signs in. The notification email is a courtesy on top, so a
// delivery failure (bad address, Resend hiccup) doesn't undo the
// whitelisting itself.
export async function whitelistMember(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;
  const languageIds = formData.getAll("languageIds").map(Number).filter((id) => !Number.isNaN(id));

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("name, slug").eq("id", organizationId).single();
  const adminPath = org ? `/learn/${org.slug}/admin` : "/learn";

  if (!email || !ROLES.includes(role)) {
    redirect(`${adminPath}?error=${encodeURIComponent("A valid email and role are required.")}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("organization_whitelist").insert({
    organization_id: organizationId,
    email,
    role,
    language_ids: languageIds,
    invited_by: user?.id,
  });

  if (error) {
    redirect(`${adminPath}?error=${encodeURIComponent(error.message)}`);
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

  revalidatePath(adminPath);
  redirect(`${adminPath}?success=${encodeURIComponent(`${email} whitelisted.`)}`);
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
    .select("organization_id, claimed_by, organization:organizations(slug)")
    .eq("id", whitelistId)
    .single();

  const orgSlug = (entry?.organization as unknown as { slug: string } | null)?.slug;
  const adminPath = orgSlug ? `/learn/${orgSlug}/admin` : "/learn";

  if (!entry) {
    redirect(`${adminPath}?error=${encodeURIComponent("Whitelist entry not found.")}`);
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
    redirect(`${adminPath}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(adminPath);
  redirect(`${adminPath}?success=${encodeURIComponent("Member removed.")}`);
}

// Covers two cases with the same action: assigning a language for the
// first time to someone recognized via domain-match (claimed, but
// language_ids was empty - lib/organization-whitelist.ts), and an admin
// changing an as-yet-unclaimed invite's languages before that person ever
// signs in. Only the first case needs an immediate enrollInLanguages call -
// for the second, claimWhitelistSeat will enroll them based on the updated
// language_ids the next time they actually sign in.
export async function assignWhitelistLanguages(formData: FormData) {
  const whitelistId = Number(formData.get("whitelistId"));
  const languageIds = formData.getAll("languageIds").map(Number).filter((id) => !Number.isNaN(id));

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("organization_whitelist")
    .select("organization_id, claimed_by, organization:organizations(slug)")
    .eq("id", whitelistId)
    .single();

  const orgSlug = (entry?.organization as unknown as { slug: string } | null)?.slug;
  const adminPath = orgSlug ? `/learn/${orgSlug}/admin` : "/learn";

  if (!entry) {
    redirect(`${adminPath}?error=${encodeURIComponent("Whitelist entry not found.")}`);
  }

  const { error } = await supabase
    .from("organization_whitelist")
    .update({ language_ids: languageIds })
    .eq("id", whitelistId);

  if (error) {
    redirect(`${adminPath}?error=${encodeURIComponent(error.message)}`);
  }

  if (entry.claimed_by) {
    const admin = createAdminClient();
    await enrollInLanguages(admin, entry.organization_id, entry.claimed_by, languageIds);
  }

  revalidatePath(adminPath);
  redirect(`${adminPath}?success=${encodeURIComponent("Languages assigned.")}`);
}

// Bulk version of whitelistMember for a whole class roster at once. Role
// and languages are picked once for the whole batch (not per-row from the
// file) - a roster upload is naturally scoped to one class/language, and
// there's no reliable way to resolve a free-text language column to an id
// (languages.name is the only non-null unique column; iso_code is only
// partially backfilled).
export async function bulkWhitelistRoster(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const role = formData.get("role") as string;
  const languageIds = formData.getAll("languageIds").map(Number).filter((id) => !Number.isNaN(id));
  const rosterFile = formData.get("roster") as File | null;
  const emailsText = (formData.get("emailsText") as string) ?? "";

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("name, slug").eq("id", organizationId).single();
  const adminPath = org ? `/learn/${org.slug}/admin` : "/learn";

  if (!ROLES.includes(role)) {
    redirect(`${adminPath}?error=${encodeURIComponent("A valid role is required.")}`);
  }

  const fileText = rosterFile && rosterFile.size > 0 ? await rosterFile.text() : "";
  const combinedText = `${fileText}\n${emailsText}`;
  const matches = combinedText.match(EMAIL_EXTRACT_PATTERN) ?? [];
  const emails = Array.from(new Set(matches.map((e) => e.toLowerCase())));

  if (emails.length === 0) {
    redirect(`${adminPath}?error=${encodeURIComponent("No email addresses found in the uploaded roster.")}`);
  }

  if (emails.length > MAX_ROSTER_SIZE) {
    redirect(
      `${adminPath}?error=${encodeURIComponent(`A roster can have up to ${MAX_ROSTER_SIZE} people at a time.`)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("organization_whitelist")
    .select("email")
    .eq("organization_id", organizationId);

  const existingEmails = new Set((existing ?? []).map((e) => e.email.toLowerCase()));
  const newEmails = emails.filter((e) => !existingEmails.has(e));
  const skippedCount = emails.length - newEmails.length;

  if (newEmails.length === 0) {
    redirect(
      `${adminPath}?success=${encodeURIComponent(`No new members added - all ${skippedCount} were already whitelisted.`)}`,
    );
  }

  const { error } = await supabase.from("organization_whitelist").insert(
    newEmails.map((email) => ({
      organization_id: organizationId,
      email,
      role,
      language_ids: languageIds,
      invited_by: user?.id,
    })),
  );

  if (error) {
    redirect(`${adminPath}?error=${encodeURIComponent(error.message)}`);
  }

  try {
    const { data: languages } = await supabase.from("languages").select("name").in("id", languageIds);
    const languageNames = (languages ?? []).map((l) => l.name).join(", ");
    await sendBulkEmails(
      newEmails.map((email) => ({
        to: email,
        subject: `You're in - ${org?.name ?? "your program"} on CultureMesh`,
        text: `You've been added to ${org?.name ?? "your program"} on CultureMesh${
          languageNames ? ` and enrolled in: ${languageNames}` : ""
        }. Sign in with this email to get started.`,
      })),
    );
  } catch {
    // Best-effort, same as whitelistMember - the rows above already grant access.
  }

  revalidatePath(adminPath);
  const summary =
    skippedCount > 0
      ? `Added ${newEmails.length}, skipped ${skippedCount} already whitelisted.`
      : `Added ${newEmails.length}.`;
  redirect(`${adminPath}?success=${encodeURIComponent(summary)}`);
}
