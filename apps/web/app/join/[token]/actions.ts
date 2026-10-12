"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Accepts a referral link.
 *
 * Every rule lives in accept_corridor_invite (00000000000091): that the
 * link is live, that the network is not one an organisation gates, and
 * that the count only moves when a membership is actually created. This
 * carries the call and nothing else, so there is no second copy of the
 * rules to drift.
 */
export async function acceptInvite(formData: FormData) {
  const token = formData.get("token") as string;
  const supabase = await createClient();

  const { data: networkId, error } = await supabase.rpc("accept_corridor_invite", {
    p_token: token,
  });

  if (error) {
    redirect(`/join/${token}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/networks/${networkId}`);
  redirect(`/networks/${networkId}`);
}
