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
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      `/networks/${networkId}/posts/${postId}?error=${encodeURIComponent(error.message)}${embedSuffix}`,
    );
  }

  // Same post-hoc, best-effort transcription as createPost (see the long
  // note there on why this runs after the insert and never blocks).
  let detectedLanguage: string | null = null;
  if (mediaPath && inserted) {
    const networkLanguage = await getNetworkLanguage(supabase, Number(networkId));
    if (!networkLanguage?.is_signed) {
      detectedLanguage = await transcribeStoredMedia(supabase, "post_replies", inserted.id, mediaPath);
    }
  }

  // The advisory - not the transcription - is scoped to a school's
  // language program via organization_languages, matching createPost.
  // Public networks get transcripts and captions but no language nudge.
  const { data: orgNetwork } = detectedLanguage
    ? await supabase
        .from("organization_languages")
        .select("language:languages(name, iso_code)")
        .eq("network_id", Number(networkId))
        .maybeSingle()
    : { data: null };
  const orgLanguage = orgNetwork?.language as unknown as
    | { name: string; iso_code: string | null }
    | null;

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

  if (
    detectedLanguage &&
    orgLanguage?.iso_code &&
    detectedLanguage !== orgLanguage.iso_code
  ) {
    redirect(
      `/networks/${networkId}/posts/${postId}?langNotice=${encodeURIComponent(
        `That recording sounded like it might not be in ${orgLanguage.name}. It's posted either way - just a heads up.`,
      )}${embedSuffix}`,
    );
  }
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
