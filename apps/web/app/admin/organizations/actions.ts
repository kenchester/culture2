"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/site-url";

// Subdomain links (the invite acceptance page) can't be expressed from
// localhost without a hosts-file/wildcard-DNS trick, so locally this falls
// back to the plain siteUrl path instead - matches the same hardcoded
// production-root-domain precedent already used in
// lib/supabase/cookie-options.ts.
function buildSubdomainUrl(siteUrl: string, subdomain: string, path: string): string {
  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    return `${siteUrl}${path}`;
  }
  return `https://${subdomain}.culturemesh.com${path}`;
}

export async function createOrganization(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim();
  const subdomain = (formData.get("subdomain") as string)?.trim();
  const domain = (formData.get("domain") as string)?.trim() || null;
  const locationName = (formData.get("locationName") as string)?.trim();
  const parentCountryId = formData.get("parentCountryId") as string;

  if (!name || !slug || !subdomain || !locationName || !parentCountryId) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent(
        "Name, slug, subdomain, location name, and parent country are all required.",
      )}`,
    );
  }

  const supabase = await createClient();

  // A new organization needs a location to anchor its networks to, and
  // that place doesn't exist yet for a brand-new school - created here as
  // one step so an admin never has to separately visit the
  // Languages & Geography tab first. hidden_from_search keeps it out of
  // the main site's location picker (00000000000043_organizations.sql).
  const { data: place, error: placeError } = await supabase
    .from("places")
    .insert({
      type: "city",
      name: locationName,
      parent_id: Number(parentCountryId),
      hidden_from_search: true,
    })
    .select("id")
    .single();

  if (placeError || !place) {
    redirect(`/admin/organizations?error=${encodeURIComponent(placeError?.message ?? "Could not create location.")}`);
  }

  const { error: orgError } = await supabase.from("organizations").insert({
    name,
    slug,
    subdomain,
    domain,
    location_place_id: place.id,
  });

  if (orgError) {
    redirect(`/admin/organizations?error=${encodeURIComponent(orgError.message)}`);
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent(`"${name}" created.`)}`);
}

// Adds one of the organization's fixed languages, creating (or reusing, if
// one already happens to exist at this location+language) the network
// that backs it and recording the pairing in organization_languages -
// this is what makes the language show up in the org's locked dropdown and
// the whitelist's per-language enrollment checkboxes.
export async function addOrganizationLanguage(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const languageId = Number(formData.get("languageId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name, location_place_id")
    .eq("id", organizationId)
    .single();

  if (!org) {
    redirect(`/admin/organizations?error=${encodeURIComponent("Organization not found.")}`);
  }

  const { data: existingNetwork } = await supabase
    .from("networks")
    .select("id")
    .eq("language_id", languageId)
    .eq("location_place_id", org.location_place_id)
    .maybeSingle();

  let networkId = existingNetwork?.id;

  if (!networkId) {
    const { data: language } = await supabase.from("languages").select("name").eq("id", languageId).single();
    const { data: newNetwork, error: networkError } = await supabase
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
      redirect(`/admin/organizations?error=${encodeURIComponent(networkError?.message ?? "Could not create network.")}`);
    }
    networkId = newNetwork.id;
  }

  const { error } = await supabase
    .from("organization_languages")
    .insert({ organization_id: organizationId, language_id: languageId, network_id: networkId });

  if (error) {
    redirect(`/admin/organizations?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent("Language network added.")}`);
}

// Bootstraps an org's first admin - the one case with no existing org
// admin to grant access another way, so it goes through a real
// accept-by-token link rather than the whitelist-claim flow every other
// member uses.
export async function inviteFirstAdmin(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    redirect(`/admin/organizations?error=${encodeURIComponent("An email is required.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, subdomain")
    .eq("id", organizationId)
    .single();

  if (!org) {
    redirect(`/admin/organizations?error=${encodeURIComponent("Organization not found.")}`);
  }

  const { data: invite, error } = await supabase
    .from("organization_admin_invites")
    .insert({ organization_id: organizationId, email, invited_by: user?.id })
    .select("token")
    .single();

  if (error || !invite) {
    redirect(`/admin/organizations?error=${encodeURIComponent(error?.message ?? "Could not create invite.")}`);
  }

  const siteUrl = await getSiteUrl();
  const inviteUrl = buildSubdomainUrl(siteUrl, org.subdomain, `/invite/${invite.token}`);

  try {
    await sendEmail({
      to: email,
      subject: `You've been invited to administer ${org.name} on CultureMesh`,
      text: `You've been invited to be the first admin for ${org.name} on CultureMesh. As an admin, you'll be able to whitelist students and instructors and enroll them into their language networks.\n\nAccept your invite:\n${inviteUrl}\n\nThis link expires in 14 days.`,
    });
  } catch (err) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Invite created but the email failed to send.",
      )}`,
    );
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent(`Invite sent to ${email}.`)}`);
}
