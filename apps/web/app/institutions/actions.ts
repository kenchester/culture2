"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Staff authority is enforced by the RLS policies on corridor_invites
// (00000000000091), which also refuse an invite pointing at a network an
// organisation gates. These actions carry the write and surface the
// message; they do not re-state who is allowed to do what.

export async function createCorridorInvite(formData: FormData) {
  const institutionId = Number(formData.get("institutionId"));
  const networkId = Number(formData.get("networkId"));
  const note = ((formData.get("note") as string) ?? "").trim();
  const path = `/institutions/${institutionId}`;
  const supabase = await createClient();

  const { error } = await supabase.from("corridor_invites").insert({
    institution_id: institutionId,
    network_id: networkId,
    note: note || null,
  });

  if (error) {
    redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(path);
  redirect(path);
}

export async function revokeCorridorInvite(formData: FormData) {
  const institutionId = Number(formData.get("institutionId"));
  const inviteId = Number(formData.get("inviteId"));
  const path = `/institutions/${institutionId}`;
  const supabase = await createClient();

  const { error } = await supabase
    .from("corridor_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) {
    redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(path);
  redirect(path);
}
