"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimWhitelistSeat } from "@/lib/organization-whitelist";
import { sendEmail } from "@/lib/email";

const VERIFICATION_CODE_TTL_MINUTES = 15;

// Self-serve network creation for a real (non-example) school: any
// recognized member - not just an org admin - can start a network for a
// language their school doesn't offer yet, no admin approval needed
// (app/learn/[slug]/page.tsx's LaunchNetworkForm, shown in place of
// Acme's locked example-language search). "Recognized" means
// claimWhitelistSeat (app/learn/[slug]/layout.tsx) already ran this
// request and found either an org_admin row or a claimed whitelist row for
// this user - the same check the page itself uses to decide whether to
// render the form at all, re-verified here since a form action is a
// separate request. organization_languages' insert policy is global-
// admin-only (00000000000043_organizations.sql), so this goes through the
// service-role client once that authorization check passes, the same
// pattern approveOrganizationRequest already uses.
export async function launchLanguageNetwork(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const languageId = Number(formData.get("languageId"));
  const slug = formData.get("slug") as string;
  const backTo = `/learn/${slug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(backTo)}`);
  }
  if (!organizationId || !languageId) {
    redirect(`${backTo}?error=${encodeURIComponent("Pick a language first.")}`);
  }

  const admin = createAdminClient();

  const [{ data: adminMembership }, { data: whitelistEntry }] = await Promise.all([
    admin
      .from("organization_admins")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("organization_whitelist")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("claimed_by", user.id)
      .maybeSingle(),
  ]);

  if (!adminMembership && !whitelistEntry) {
    redirect(`${backTo}?error=${encodeURIComponent("Only recognized members of this school can launch a network.")}`);
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name, location_place_id")
    .eq("id", organizationId)
    .single();
  if (!org) {
    redirect(backTo);
  }

  const { data: existingLink } = await admin
    .from("organization_languages")
    .select("network_id")
    .eq("organization_id", organizationId)
    .eq("language_id", languageId)
    .maybeSingle();

  if (existingLink) {
    redirect(`/networks/${existingLink.network_id}`);
  }

  const { data: existingNetwork } = await admin
    .from("networks")
    .select("id")
    .eq("language_id", languageId)
    .eq("location_place_id", org.location_place_id)
    .maybeSingle();

  let networkId = existingNetwork?.id;

  if (!networkId) {
    const { data: language } = await admin.from("languages").select("name").eq("id", languageId).single();
    const { data: newNetwork, error: networkError } = await admin
      .from("networks")
      .insert({
        language_id: languageId,
        location_place_id: org.location_place_id,
        title: `${language?.name ?? "Language"} speakers at ${org.name}`,
        launched_by: user.id,
      })
      .select("id")
      .single();

    if (networkError || !newNetwork) {
      redirect(`${backTo}?error=${encodeURIComponent(networkError?.message ?? "Could not launch network.")}`);
    }
    networkId = newNetwork.id;
  }

  const { error: linkError } = await admin
    .from("organization_languages")
    .insert({ organization_id: organizationId, language_id: languageId, network_id: networkId });
  if (linkError) {
    redirect(`${backTo}?error=${encodeURIComponent(linkError.message)}`);
  }

  await admin
    .from("network_members")
    .upsert({ network_id: networkId, user_id: user.id }, { onConflict: "network_id,user_id", ignoreDuplicates: true });

  redirect(`/networks/${networkId}`);
}

// Step 1 of "prove you also control a school email" (VerifySchoolEmailForm,
// shown in place of GetStartedBanner when someone's signed in under an
// identity that isn't recognized by this org - a different school's
// account, or their main CultureMesh account). Deliberately not routed
// through Supabase Auth's own OTP: that would mean either creating a
// second auth.users identity for the same person or switching them out of
// their current session, when the actual goal is adding this email to the
// profile they're already signed in as. Unlike the best-effort
// notification emails elsewhere in this app, a failed send here has to be
// a real error - the code IS the point of this request.
export async function requestEmailVerificationCode(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const slug = formData.get("slug") as string;
  const backTo = `/learn/${slug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(backTo)}`);
  }
  if (!email || !email.includes("@")) {
    redirect(`${backTo}?verifyError=${encodeURIComponent("Enter a valid email address.")}`);
  }

  const admin = createAdminClient();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await admin
    .from("pending_email_verifications")
    .insert({ profile_id: user.id, email, code, expires_at: expiresAt });
  if (insertError) {
    redirect(`${backTo}?verifyError=${encodeURIComponent("Could not send a code. Try again.")}`);
  }

  try {
    await sendEmail({
      to: email,
      subject: "Your CultureMesh verification code",
      text: `Your verification code is ${code}. It expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.\n\nIf you didn't request this, you can ignore this email.`,
    });
  } catch {
    redirect(`${backTo}?verifyError=${encodeURIComponent("Could not send the email. Try again.")}`);
  }

  redirect(`${backTo}?verifyEmail=${encodeURIComponent(email)}`);
}

// Step 2: checks the code, records the email as verified for this profile
// (not this session - it survives sign-out/sign-in), then immediately
// re-runs claimWhitelistSeat so the visitor lands back on the page already
// recognized rather than needing an unrelated second visit to trigger it.
export async function verifyEmailCode(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const code = (formData.get("code") as string)?.trim();
  const slug = formData.get("slug") as string;
  const backTo = `/learn/${slug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(backTo)}`);
  }

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("pending_email_verifications")
    .select("id, expires_at")
    .eq("profile_id", user.id)
    .eq("email", email)
    .eq("code", code)
    .maybeSingle();

  if (!pending || new Date(pending.expires_at) < new Date()) {
    redirect(
      `${backTo}?verifyEmail=${encodeURIComponent(email)}&verifyError=${encodeURIComponent("That code is invalid or expired.")}`,
    );
  }

  await admin
    .from("verified_school_emails")
    .upsert({ profile_id: user.id, email }, { onConflict: "profile_id,email", ignoreDuplicates: true });
  await admin.from("pending_email_verifications").delete().eq("profile_id", user.id).eq("email", email);

  await claimWhitelistSeat(slug);

  redirect(backTo);
}
