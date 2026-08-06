"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createReply(formData: FormData) {
  const postId = formData.get("postId") as string;
  const networkId = formData.get("networkId") as string;
  const body = formData.get("body") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to reply.")}`);
  }

  const { error } = await supabase.from("post_replies").insert({
    post_id: Number(postId),
    user_id: user.id,
    body,
  });

  if (error) {
    redirect(
      `/networks/${networkId}/posts/${postId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/networks/${networkId}/posts/${postId}`);
}
