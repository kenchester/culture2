"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";

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

  // Best-effort - a failed notification must never turn a successful
  // reply into an error page for the person replying.
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (post && post.user_id !== user.id) {
      const recipients = await getOptedInRecipients([post.user_id], "replies_to_your_posts");
      if (recipients.length > 0) {
        const siteUrl = await getSiteUrl();
        await sendEmail({
          to: recipients[0].email,
          subject: "New reply on your CultureMesh post",
          text: `Someone replied to your post on CultureMesh.\n\n${siteUrl}/networks/${networkId}/posts/${postId}`,
        });
      }
    }
  } catch {
    // notification failure is non-fatal
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
