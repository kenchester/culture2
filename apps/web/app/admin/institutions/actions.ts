"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Institutions are vetted by hand - a resettlement agency office or a
// hometown association is a relationship, not a signup - so creation and
// staffing live behind the admin layout's is_admin gate rather than being
// self-served.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?returnTo=/admin/institutions");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/");
  return user;
}

function back(message?: string): never {
  redirect(
    message ? `/admin/institutions?error=${encodeURIComponent(message)}` : "/admin/institutions",
  );
}

export async function createInstitution(formData: FormData) {
  const user = await requireAdmin();
  const name = ((formData.get("name") as string) ?? "").trim();
  const kind = formData.get("kind") as string;
  const placeId = Number(formData.get("placeId"));
  const contactEmail = ((formData.get("contactEmail") as string) ?? "").trim();

  if (!name) back("A name is required.");
  if (!placeId) back("Choose the city this institution works in.");

  const { error } = await createAdminClient().from("institutions").insert({
    name,
    kind,
    place_id: placeId,
    contact_email: contactEmail || null,
    created_by: user.id,
  });
  if (error) back(error.message);
  revalidatePath("/admin/institutions");
  back();
}

export async function addInstitutionStaff(formData: FormData) {
  const user = await requireAdmin();
  const institutionId = Number(formData.get("institutionId"));
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  if (!email) back("An email address is required.");

  const admin = createAdminClient();
  // The staff member must already have a CultureMesh account; this grants
  // authority over referral links, so it is never created from an address
  // nobody has confirmed.
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = users?.users.find((u) => u.email?.toLowerCase() === email);
  if (!match) back(`No CultureMesh account for ${email}. Ask them to sign up first.`);

  const { error } = await admin
    .from("institution_staff")
    .insert({ institution_id: institutionId, user_id: match.id, added_by: user.id });
  if (error) back(error.message);
  revalidatePath("/admin/institutions");
  back();
}

export async function archiveInstitution(formData: FormData) {
  await requireAdmin();
  const institutionId = Number(formData.get("institutionId"));
  // Archived, not deleted: its referral counts are the only record that
  // the handoffs happened, and deleting the row cascades them away.
  const { error } = await createAdminClient()
    .from("institutions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", institutionId);
  if (error) back(error.message);
  revalidatePath("/admin/institutions");
  back();
}
