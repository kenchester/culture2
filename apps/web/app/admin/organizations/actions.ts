"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/site-url";
import { RESERVED_LEARN_SLUGS } from "@/lib/supabase/proxy";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Self-serve requests (approveOrganizationRequest below) generate their own
// slug from the school name rather than having someone type one - has to
// dodge both the reserved-path list and any slug already in use.
async function generateUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  const { data: existing } = await supabase.from("organizations").select("slug").ilike("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((o) => o.slug));

  if (!taken.has(base) && !RESERVED_LEARN_SLUGS.includes(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`) || RESERVED_LEARN_SLUGS.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export async function createOrganization(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim();
  const domain = (formData.get("domain") as string)?.trim() || null;
  const parentPlaceId = formData.get("parentPlaceId") as string;

  if (!name || !slug || !parentPlaceId) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent(
        "Name, slug, and parent geography are all required.",
      )}`,
    );
  }

  // The subdomain's routing (lib/supabase/proxy.ts) treats a school's first
  // path segment as its slug, except for this app's real top-level routes -
  // a slug matching one of those would silently never be reachable.
  if (RESERVED_LEARN_SLUGS.includes(slug)) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent(
        `"${slug}" is a reserved path and can't be used as a slug.`,
      )}`,
    );
  }

  const supabase = await createClient();

  // A new organization needs a location to anchor its networks to, and
  // that place doesn't exist yet for a brand-new school - created here as
  // one step so an admin never has to separately visit the
  // Languages & Geography tab first. hidden_from_search keeps it out of
  // the main site's location picker (00000000000043_organizations.sql).
  // type 'campus' anchors the school as a sub-city point under whatever
  // real country/region/city was picked as its parent geography, named
  // after the org itself rather than needing a separate location name
  // (00000000000058_campus_place_type.sql).
  const { data: place, error: placeError } = await supabase
    .from("places")
    .insert({
      type: "campus",
      name,
      parent_id: Number(parentPlaceId),
      hidden_from_search: true,
    })
    .select("id")
    .single();

  if (placeError || !place) {
    redirect(`/admin/organizations?error=${encodeURIComponent(placeError?.message ?? "Could not create location.")}`);
  }

  const domainSigninEnabled = formData.get("domainSigninEnabled") === "on";

  // Every school lives under the shared learn.culturemesh.com subdomain,
  // distinguished by slug (lib/supabase/proxy.ts) - subdomain itself is no
  // longer something an admin picks per org (see
  // 00000000000056_org_subdomain_not_unique.sql).
  const { error: orgError } = await supabase.from("organizations").insert({
    name,
    slug,
    subdomain: "learn",
    domain,
    domain_signin_enabled: domainSigninEnabled,
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

// Lets a global admin update a school's domain after creation, and
// separately turn off domain-based auto-recognition (lib/organization-
// whitelist.ts) - some small language schools don't issue students an
// institutional email at all, but might still want a domain on file for
// the marketing banner's domain-check.
export async function updateOrganizationDomainSettings(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const domain = (formData.get("domain") as string)?.trim().toLowerCase() || null;
  const domainSigninEnabled = formData.get("domainSigninEnabled") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ domain, domain_signin_enabled: domainSigninEnabled })
    .eq("id", organizationId);

  if (error) {
    redirect(`/admin/organizations?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent("Domain settings updated.")}`);
}

// The first genuinely destructive admin action in the app - the form
// requires the org's slug to be typed to confirm, checked here too (not
// just client-side), since a mistyped confirmation should never delete
// anything by accident.
//
// Deliberately does NOT delete profiles/auth.users for former members - a
// student's CultureMesh account may have activity unrelated to this
// school, and full account deletion should stay a separate, explicit,
// user-initiated action rather than a side effect of a contract ending.
export async function deleteOrganization(formData: FormData) {
  const organizationId = Number(formData.get("organizationId"));
  const confirmSlug = (formData.get("confirmSlug") as string)?.trim();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("slug, name, location_place_id")
    .eq("id", organizationId)
    .single();

  if (!org) {
    redirect(`/admin/organizations?error=${encodeURIComponent("Organization not found.")}`);
  }

  if (confirmSlug !== org.slug) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent(`Type "${org.slug}" exactly to confirm deletion.`)}`,
    );
  }

  const admin = createAdminClient();

  // Read the network ids before anything is deleted - organization_languages
  // (which links an org to its networks) is about to disappear.
  const { data: orgLanguages } = await admin
    .from("organization_languages")
    .select("network_id")
    .eq("organization_id", organizationId);
  const networkIds = (orgLanguages ?? []).map((l) => l.network_id);

  // Delete the org FIRST - organization_languages.network_id has no ON
  // DELETE CASCADE (it's a plain FK to networks, not the other direction),
  // so deleting a network while organization_languages still references it
  // fails with a foreign key violation. Deleting organizations cascades
  // away organization_languages/organization_admins/
  // organization_admin_invites/organization_whitelist (existing FKs) and
  // clears that reference, so the networks below are safe to delete next.
  const { error: orgError } = await admin.from("organizations").delete().eq("id", organizationId);
  if (orgError) {
    redirect(`/admin/organizations?error=${encodeURIComponent(orgError.message)}`);
  }

  // Cascades to posts, post_replies, and network_members (existing FKs).
  if (networkIds.length > 0) {
    const { error: networksError } = await admin.from("networks").delete().in("id", networkIds);
    if (networksError) {
      redirect(`/admin/organizations?error=${encodeURIComponent(networksError.message)}`);
    }
  }

  const { error: placeError } = await admin.from("places").delete().eq("id", org.location_place_id);
  if (placeError) {
    redirect(`/admin/organizations?error=${encodeURIComponent(placeError.message)}`);
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent(`"${org.name}" deleted.`)}`);
}

// Approving a self-serve request (app/learn/start) provisions a real org in
// one step - mirrors createOrganization + addOrganizationLanguage's exact
// logic rather than calling those (both are form-bound with their own
// redirect(), not suited to being invoked internally). The requester
// already proved they control institutional_email by being signed in when
// they submitted, so admin access is granted directly here - no separate
// invite-token email round trip like inviteFirstAdmin needs.
export async function approveOrganizationRequest(formData: FormData) {
  const requestId = Number(formData.get("requestId"));
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("organization_requests")
    .select(
      "id, requested_by, institutional_email, school_name, language_id, parent_place_id, status",
    )
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    redirect(`/admin/organizations?error=${encodeURIComponent("Request not found or already reviewed.")}`);
  }

  const { data: place, error: placeError } = await supabase
    .from("places")
    .insert({
      type: "campus",
      name: request.school_name,
      parent_id: request.parent_place_id,
      hidden_from_search: true,
    })
    .select("id")
    .single();

  if (placeError || !place) {
    redirect(`/admin/organizations?error=${encodeURIComponent(placeError?.message ?? "Could not create location.")}`);
  }

  const domain = request.institutional_email.split("@")[1];
  const slug = await generateUniqueSlug(supabase, slugify(request.school_name));

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: request.school_name,
      slug,
      subdomain: "learn",
      domain,
      domain_signin_enabled: true,
      location_place_id: place.id,
    })
    .select("id, name, slug")
    .single();

  if (orgError || !org) {
    redirect(`/admin/organizations?error=${encodeURIComponent(orgError?.message ?? "Could not create organization.")}`);
  }

  const { data: language } = await supabase.from("languages").select("name").eq("id", request.language_id).single();
  // launched_by can't be the requester here - networks' RLS insert check is
  // (auth.uid() = launched_by) or null, and the actual authenticated actor
  // performing this insert is the reviewing admin, not the requester. null
  // fits the "auto-provisioned by an approval, not directly launched by a
  // signed-in actor" case correctly.
  const { data: newNetwork, error: networkError } = await supabase
    .from("networks")
    .insert({
      language_id: request.language_id,
      location_place_id: place.id,
      title: `${language?.name ?? "Language"} speakers at ${org.name}`,
      launched_by: null,
    })
    .select("id")
    .single();

  if (networkError || !newNetwork) {
    redirect(`/admin/organizations?error=${encodeURIComponent(networkError?.message ?? "Could not create network.")}`);
  }

  const { error: orgLanguageError } = await supabase
    .from("organization_languages")
    .insert({ organization_id: org.id, language_id: request.language_id, network_id: newNetwork.id });

  if (orgLanguageError) {
    redirect(`/admin/organizations?error=${encodeURIComponent(orgLanguageError.message)}`);
  }

  // organization_admins can't be inserted by a regular authenticated user
  // (see acceptOrganizationInvite) - only the service-role client can grant
  // it directly.
  const admin = createAdminClient();
  await admin
    .from("organization_admins")
    .insert({ organization_id: org.id, user_id: request.requested_by, granted_by: null });

  await supabase
    .from("organization_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), resulting_organization_id: org.id })
    .eq("id", requestId);

  try {
    const siteUrl = await getSiteUrl();
    const adminUrl = buildSubdomainUrl(siteUrl, "learn", `/learn/${org.slug}/admin`);
    await sendEmail({
      to: request.institutional_email,
      subject: `Your class on CultureMesh Learn is live`,
      text: `${org.name} is live on CultureMesh Learn. Manage it here:\n${adminUrl}`,
    });
  } catch {
    // Best-effort - the org already exists and the requester already has
    // admin access, so a failed notification shouldn't look like a failure.
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent(`"${org.name}" approved and live.`)}`);
}

export async function rejectOrganizationRequest(formData: FormData) {
  const requestId = Number(formData.get("requestId"));
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("organization_requests")
    .select("institutional_email, school_name, status")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    redirect(`/admin/organizations?error=${encodeURIComponent("Request not found or already reviewed.")}`);
  }

  const { error } = await supabase
    .from("organization_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    redirect(`/admin/organizations?error=${encodeURIComponent(error.message)}`);
  }

  try {
    await sendEmail({
      to: request.institutional_email,
      subject: `Your CultureMesh Learn request`,
      text: `Thanks for your interest in CultureMesh Learn for ${request.school_name}. We're not able to approve this request right now.`,
    });
  } catch {
    // Best-effort, same as above.
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations?success=${encodeURIComponent("Request rejected.")}`);
}
