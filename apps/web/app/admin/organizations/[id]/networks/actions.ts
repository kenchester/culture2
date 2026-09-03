"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Both actions below are reachable only from /admin/organizations/[id]/
// networks, which sits under the admin layout's is_admin gate. They
// re-derive the organization from the network itself rather than trusting
// an organizationId posted alongside it, so a tampered form can't move a
// network between schools or aim a delete at an unrelated one.

async function requireGlobalAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    redirect("/admin/organizations");
  }
}

export async function renameOrgNetwork(formData: FormData) {
  const networkId = Number(formData.get("networkId"));
  const organizationId = Number(formData.get("organizationId"));
  const title = ((formData.get("title") as string) ?? "").trim();
  const backTo = `/admin/organizations/${organizationId}/networks`;

  await requireGlobalAdmin();

  if (!title) {
    redirect(`${backTo}?error=${encodeURIComponent("A network needs a title.")}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("networks").update({ title }).eq("id", networkId);
  if (error) {
    redirect(`${backTo}?error=${encodeURIComponent(error.message)}`);
  }

  // The network's own page and the school page both render this title.
  revalidatePath(backTo);
  revalidatePath(`/networks/${networkId}`);
  redirect(`${backTo}?success=${encodeURIComponent("Network renamed.")}`);
}

export async function deleteOrgNetwork(formData: FormData) {
  const networkId = Number(formData.get("networkId"));
  const organizationId = Number(formData.get("organizationId"));
  const confirmTitle = ((formData.get("confirmTitle") as string) ?? "").trim();
  const backTo = `/admin/organizations/${organizationId}/networks`;

  await requireGlobalAdmin();

  const admin = createAdminClient();
  const { data: network } = await admin
    .from("networks")
    .select("id, title")
    .eq("id", networkId)
    .maybeSingle();

  if (!network) {
    redirect(`${backTo}?error=${encodeURIComponent("That network no longer exists.")}`);
  }

  // Checked server-side, not just in the form: a mistyped confirmation
  // should never destroy a network's posts by accident. Same reasoning as
  // deleteOrganization's slug confirmation.
  if (confirmTitle !== network.title) {
    redirect(
      `${backTo}?error=${encodeURIComponent(`Type the network's title exactly to delete it.`)}`,
    );
  }

  // organization_languages.network_id is a plain FK with no ON DELETE
  // CASCADE, so the link row has to go first or the network delete fails
  // with a foreign key violation. Posts, replies and members do cascade.
  const { error: linkError } = await admin
    .from("organization_languages")
    .delete()
    .eq("network_id", networkId);
  if (linkError) {
    redirect(`${backTo}?error=${encodeURIComponent(linkError.message)}`);
  }

  const { error: networkError } = await admin.from("networks").delete().eq("id", networkId);
  if (networkError) {
    redirect(`${backTo}?error=${encodeURIComponent(networkError.message)}`);
  }

  revalidatePath(backTo);
  revalidatePath("/admin/organizations");
  redirect(`${backTo}?success=${encodeURIComponent(`"${network.title}" deleted.`)}`);
}
