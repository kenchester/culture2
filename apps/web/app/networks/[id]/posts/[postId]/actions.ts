"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createReply(formData: FormData) {
  const postId = formData.get("postId") as string;
  const networkId = formData.get("networkId") as string;
  const body = formData.get("body") as string;
  const embedSuffix = formData.get("embed") === "1" ? "&embed=1" : "";

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
      `/networks/${networkId}/posts/${postId}?error=${encodeURIComponent(error.message)}${embedSuffix}`,
    );
  }

  revalidatePath(`/networks/${networkId}/posts/${postId}`);
}

type ActionResult = { ok: true } | { error: string };

export async function updateReply(replyId: number, body: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("post_replies")
    .update({ body })
    .eq("id", replyId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export async function deleteReply(replyId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("post_replies")
    .delete()
    .eq("id", replyId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}
