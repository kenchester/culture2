"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The only write the consul's page allows.
 *
 * Who may do it lives in update_outpost_page (00000000000088), not here:
 * the serving-officer check and the expired-term check are one copy, in
 * the database, so this action cannot drift away from them.
 */
export async function saveConsulPage(formData: FormData) {
  const outpostId = Number(formData.get("outpostId"));
  const path = `/outposts/${outpostId}`;
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_outpost_page", {
    p_outpost_id: outpostId,
    p_about: (formData.get("about") as string) ?? "",
    p_contact: (formData.get("contact") as string) ?? "",
    p_website: (formData.get("website") as string) ?? "",
  });

  if (error) {
    redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(path);
  redirect(`${path}?saved=1`);
}
