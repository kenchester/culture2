"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
