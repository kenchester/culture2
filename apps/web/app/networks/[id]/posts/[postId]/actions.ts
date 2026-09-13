"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";
import { getNetworkLanguage, transcribeStoredMedia } from "@/lib/transcription";

export async function createReply(formData: FormData) {
  const postId = formData.get("postId") as string;
  const networkId = formData.get("networkId") as string;
  const body = (formData.get("body") as string) ?? "";
  // Set when replying to another reply rather than to the post itself
  // (00000000000079). Stored as an id, never parsed back out of the text.
  const replyToUserIdRaw = (formData.get("replyToUserId") as string) || null;
  const embedSuffix = formData.get("embed") === "1" ? "&embed=1" : "";

  // Same media fields as createPost (app/networks/actions.ts) - either a
  // text body OR these three, set by RecordMedia after it uploads directly
  // to the post-media bucket.
  const mediaTypeRaw = (formData.get("mediaType") as string) || null;
  const mediaPath = (formData.get("mediaPath") as string) || null;
  const mediaType = mediaTypeRaw === "audio" || mediaTypeRaw === "video" ? mediaTypeRaw : null;
  const mediaDurationRaw = formData.get("mediaDurationSeconds") as string;
  const mediaDurationSeconds = mediaDurationRaw ? Number(mediaDurationRaw) : null;

  // Signed-language networks only (app/networks/[id]/signed-summary-fields.tsx).
  // The pair is enforced by a check constraint (00000000000072): a summary
  // without its language is not storable, since the language is what makes
  // it translatable and readable by a screen reader.
  const summaryTextRaw = ((formData.get("summaryText") as string) ?? "").trim();
  const summaryLanguageRaw = (formData.get("summaryLanguageId") as string) || "";
  const summaryText = summaryTextRaw && summaryLanguageRaw ? summaryTextRaw : null;
  const summaryLanguageId = summaryText ? Number(summaryLanguageRaw) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to reply.")}`);
  }

  const { data: inserted, error } = await supabase
    .from("post_replies")
    .insert({
      post_id: Number(postId),
      user_id: user.id,
      body,
      media_type: mediaType,
      media_path: mediaPath,
      media_duration_seconds: mediaDurationSeconds,
      summary_text: summaryText,
      summary_language_id: summaryLanguageId,
      reply_to_user_id: replyToUserIdRaw,
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      `/networks/${networkId}/posts/${postId}?error=${encodeURIComponent(error.message)}${embedSuffix}`,
    );
  }

  // Best-effort and post-hoc: the reply is already inserted, so a slow or
  // failed Whisper call can never cost anyone their recording. Skipped for
  // signed languages, which have no speech to transcribe.
  if (mediaPath && inserted) {
    const networkLanguage = await getNetworkLanguage(supabase, Number(networkId));
    if (!networkLanguage?.is_signed) {
      await transcribeStoredMedia(
        supabase,
        "post_replies",
        inserted.id,
        mediaPath,
        networkLanguage?.iso_code,
      );
    }
  }

  // Best-effort - a failed notification must never turn a successful
  // reply into an error page for the person replying.
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    // Answering a particular person notifies that person and NOT the post
    // author - the point of naming someone is that the conversation has
    // moved on to them, and the original poster doesn't need telling every
    // time two other people go back and forth under their post.
    const notifyUserId = replyToUserIdRaw ?? post?.user_id ?? null;

    if (notifyUserId && notifyUserId !== user.id) {
      const recipients = await getOptedInRecipients([notifyUserId], "replies_to_your_posts");
      if (recipients.length > 0) {
        const siteUrl = await getSiteUrl();
        const link = `${siteUrl}/networks/${networkId}/posts/${postId}`;
        await sendEmail({
          to: recipients[0].email,
          subject: replyToUserIdRaw
            ? "Someone replied to you on CultureMesh"
            : "New reply on your CultureMesh post",
          text: replyToUserIdRaw
            ? `Someone replied to your comment on CultureMesh.\n\n${link}`
            : `Someone replied to your post on CultureMesh.\n\n${link}`,
        });
      }
    }
  } catch {
    // notification failure is non-fatal
  }

  revalidatePath(`/networks/${networkId}/posts/${postId}`);
  revalidatePath(`/networks/${networkId}`);
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

  const { data: existing } = await supabase
    .from("post_replies")
    .select("media_path")
    .eq("id", replyId)
    .single();

  const { error } = await supabase
    .from("post_replies")
    .delete()
    .eq("id", replyId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Best-effort, same as deletePost (app/networks/actions.ts).
  if (existing?.media_path) {
    try {
      await supabase.storage.from("post-media").remove([existing.media_path]);
    } catch {
      // ignore
    }
  }

  return { ok: true };
}
