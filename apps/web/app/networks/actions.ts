"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendBulkEmails } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";
import { getDisplayName } from "@/lib/profiles";
import { translateText } from "@/lib/azure-translator";
import { toAzureCode, type Locale } from "@/lib/locale";
import { checkLanguagePurity } from "@/lib/language-purity-check";

const MAX_INVITES = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinNetwork(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const embedSuffix = formData.get("embed") === "1" ? "&embed=1" : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-in?error=${encodeURIComponent("Sign in to join a network.")}&returnTo=${encodeURIComponent(`/networks/${networkId}`)}${embedSuffix}`,
    );
  }

  await supabase
    .from("network_members")
    .insert({ network_id: Number(networkId), user_id: user.id });

  revalidatePath(`/networks/${networkId}`);
}

export async function leaveNetwork(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const embedSuffix = formData.get("embed") === "1" ? "&embed=1" : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-in?error=${encodeURIComponent("Sign in to manage your networks.")}&returnTo=${encodeURIComponent(`/networks/${networkId}`)}${embedSuffix}`,
    );
  }

  await supabase
    .from("network_members")
    .delete()
    .eq("network_id", Number(networkId))
    .eq("user_id", user.id);

  revalidatePath(`/networks/${networkId}`);
}

export async function createPost(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const body = formData.get("body") as string;
  const embedSuffix = formData.get("embed") === "1" ? "&embed=1" : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-in?error=${encodeURIComponent("Sign in to post.")}&returnTo=${encodeURIComponent(`/networks/${networkId}`)}${embedSuffix}`,
    );
  }

  // Only organization-gated networks (Acme University's language networks)
  // enforce this - a cheap lookup that's a miss for every other post on
  // the site, which pays zero cost for the dictionary-backed check below.
  const { data: orgNetwork } = await supabase
    .from("organization_languages")
    .select("language:languages(name, iso_code)")
    .eq("network_id", Number(networkId))
    .maybeSingle();
  const orgLanguage = orgNetwork?.language as unknown as { name: string; iso_code: string | null } | null;

  if (orgLanguage?.iso_code) {
    const { blocked } = checkLanguagePurity(body, orgLanguage.iso_code);
    if (blocked) {
      redirect(
        `/networks/${networkId}?error=${encodeURIComponent(
          `Please keep your post mostly in ${orgLanguage.name} for this network - proper nouns and building names are fine.`,
        )}${embedSuffix}`,
      );
    }
  }

  const { error } = await supabase.from("posts").insert({
    network_id: Number(networkId),
    user_id: user.id,
    body,
  });

  if (error) {
    redirect(`/networks/${networkId}?error=${encodeURIComponent(error.message)}${embedSuffix}`);
  }

  // Best-effort - a failed notification must never turn a successful post
  // into an error page for the person posting it.
  try {
    const admin = createAdminClient();
    const [{ data: network }, { data: members }] = await Promise.all([
      supabase.from("networks").select("title").eq("id", Number(networkId)).single(),
      admin
        .from("network_members")
        .select("user_id")
        .eq("network_id", Number(networkId))
        .neq("user_id", user.id),
    ]);

    const memberIds = (members ?? []).map((m) => m.user_id as string);
    const recipients = await getOptedInRecipients(memberIds, "network_activity");

    if (recipients.length > 0 && network) {
      const siteUrl = await getSiteUrl();
      await sendBulkEmails(
        recipients.map((r) => ({
          to: r.email,
          subject: `New post in ${network.title}`,
          text: `There's a new post in ${network.title} on CultureMesh.\n\n${siteUrl}/networks/${networkId}`,
        })),
      );
    }
  } catch {
    // notification failure is non-fatal
  }

  revalidatePath(`/networks/${networkId}`);
}

type ActionResult = { ok: true } | { error: string };

export async function updatePost(postId: number, body: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("posts")
    .update({ body })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export async function deletePost(postId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

// Shared by both posts and replies - the likes table has a post_id and a
// reply_id column, exactly one of which is set, so a single function
// covers both instead of duplicating this per kind.
export async function toggleLike(kind: "post" | "reply", itemId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const column = kind === "post" ? "post_id" : "reply_id";

  const { data: existing } = await supabase
    .from("likes")
    .select(column)
    .eq(column, itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq(column, itemId)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    return { ok: true };
  }

  const { error } = await supabase.from("likes").insert({ [column]: itemId, user_id: user.id });

  if (error) {
    return { error: error.message };
  }

  // Best-effort - a failed notification must never turn a successful like
  // into an error for the person liking it.
  try {
    if (kind === "post") {
      const { data: post } = await supabase
        .from("posts")
        .select("user_id, network_id")
        .eq("id", itemId)
        .single();

      if (post && post.user_id !== user.id) {
        await notifyLike(post.user_id, `/networks/${post.network_id}/posts/${itemId}`);
      }
    } else {
      const { data: reply } = await supabase
        .from("post_replies")
        .select("user_id, post_id, posts(network_id)")
        .eq("id", itemId)
        .single();

      const networkId = (reply?.posts as unknown as { network_id: number } | null)?.network_id;

      if (reply && reply.user_id !== user.id && networkId) {
        await notifyLike(reply.user_id, `/networks/${networkId}/posts/${reply.post_id}`);
      }
    }
  } catch {
    // notification failure is non-fatal
  }

  return { ok: true };
}

async function notifyLike(authorId: string, path: string) {
  const recipients = await getOptedInRecipients([authorId], "likes_on_your_posts");
  if (recipients.length === 0) {
    return;
  }
  const siteUrl = await getSiteUrl();
  await sendEmail({
    to: recipients[0].email,
    subject: "Someone liked your CultureMesh post",
    text: `Someone liked your post on CultureMesh.\n\n${siteUrl}${path}`,
  });
}

export async function sendNetworkInvites(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const emailsRaw = formData.get("emails") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to invite friends.")}`);
  }

  const emails = Array.from(
    new Set(
      emailsRaw
        .split(",")
        .map((e) => e.trim())
        .filter((e) => EMAIL_PATTERN.test(e)),
    ),
  );

  if (emails.length === 0) {
    redirect(
      `/networks/${networkId}?inviteError=${encodeURIComponent("Enter at least one valid email address.")}`,
    );
  }

  if (emails.length > MAX_INVITES) {
    redirect(
      `/networks/${networkId}?inviteError=${encodeURIComponent(`You can invite up to ${MAX_INVITES} people at a time.`)}`,
    );
  }

  const [{ data: network }, { data: inviterProfile }] = await Promise.all([
    supabase.from("networks").select("title").eq("id", Number(networkId)).single(),
    supabase
      .from("profiles")
      .select("first_name, last_name, username")
      .eq("id", user.id)
      .single(),
  ]);

  const inviterName = inviterProfile ? getDisplayName(inviterProfile) : "Someone";
  const networkTitle = network?.title ?? "a network";
  const siteUrl = await getSiteUrl();

  // Unlike the other notification triggers, sending IS the whole point of
  // this action - there's no other successful side effect to fall back on,
  // so a failed send here must surface as a real error, not silently
  // report "Invites sent."
  try {
    await sendBulkEmails(
      emails.map((to) => ({
        to,
        subject: `${inviterName} invited you to join ${networkTitle} on CultureMesh`,
        text: `${inviterName} thought you'd want to join "${networkTitle}" on CultureMesh.\n\n${siteUrl}/networks/${networkId}`,
      })),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong sending invites.";
    redirect(`/networks/${networkId}?inviteError=${encodeURIComponent(message)}`);
  }

  redirect(`/networks/${networkId}?invited=1`);
}

// Cached in post_translations so a given post/reply is only ever sent to
// Azure once per target locale, regardless of how many viewers click
// Translate - mirrors toggleLike's kind discriminator (one function for
// both posts and replies via which column is set) rather than duplicating
// this per kind.
export async function translateEntry(
  kind: "post" | "reply",
  itemId: number,
  targetLocale: Locale,
): Promise<{ ok: true; text: string } | { error: string }> {
  const supabase = await createClient();
  const t = await getTranslations("editableEntry");
  const column = kind === "post" ? "post_id" : "reply_id";

  const { data: cached } = await supabase
    .from("post_translations")
    .select("translated_body")
    .eq(column, itemId)
    .eq("target_locale", targetLocale)
    .maybeSingle();

  if (cached) {
    return { ok: true, text: cached.translated_body };
  }

  const table = kind === "post" ? "posts" : "post_replies";
  const { data: entry } = await supabase.from(table).select("body").eq("id", itemId).single();

  if (!entry) {
    return { error: t("translateNotFound") };
  }

  let translated: string;
  try {
    const result = await translateText(entry.body, toAzureCode(targetLocale));
    translated = result.text;
  } catch {
    return { error: t("translateFailed") };
  }

  // Best-effort - a failed cache write must never turn a successful
  // translation into an error for the person who triggered it; the next
  // viewer to click Translate just triggers another live call instead of
  // getting a cache hit.
  try {
    await supabase
      .from("post_translations")
      .insert({ [column]: itemId, target_locale: targetLocale, translated_body: translated });
  } catch {
    // cache write failure is non-fatal
  }

  return { ok: true, text: translated };
}
