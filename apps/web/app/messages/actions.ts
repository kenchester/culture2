"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startConversation(formData: FormData) {
  const otherUserId = formData.get("otherUserId") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to send a message.")}`);
  }

  const { data: conversationId, error } = await supabase.rpc("start_conversation", {
    p_other_user_id: otherUserId,
  });

  if (error) {
    redirect(`/profile/${otherUserId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/messages/${conversationId}`);
}
