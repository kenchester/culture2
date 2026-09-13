import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { gatedContextForPost } from "@/lib/gated-access";
import { SignInToView } from "@/components/sign-in-to-view";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getPostMediaUrl } from "@/lib/post-media";
import { EditableEntry } from "@/app/networks/editable-entry";
import { ReplyRow, type ReplyView } from "@/app/networks/[id]/posts/[postId]/reply-thread";
import { ReplySection } from "@/app/networks/[id]/posts/[postId]/reply-section";

function extractCount(value: unknown): number {
  const count = (value as { count: number } | { count: number }[] | null) ?? { count: 0 };
  return Array.isArray(count) ? (count[0]?.count ?? 0) : count.count;
}

/**
 * A single reply, on its own page.
 *
 * Shows the network it belongs to, the post being replied to, and this one
 * reply - and deliberately no other replies. A link to a reply is a link to
 * something specific someone said; dropping the reader into the middle of a
 * forty-message thread and asking them to find it is the thing this page
 * exists to avoid. The arrow leads back to the post, where the whole thread
 * is available.
 *
 * Readability is governed entirely by RLS. Public networks - the main site
 * and every subdomain - are readable by anyone with the link. An org-gated
 * school network returns no rows to a non-member (00000000000078), so this
 * 404s for them rather than leaking that the reply exists.
 */
export default async function ReplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; postId: string; replyId: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { id, postId, replyId } = await params;
  const { embed } = await searchParams;
  const embedSuffix = embed === "1" ? "?embed=1" : "";
  const supabase = await createClient();
  const t = await getTranslations("postDetail");

  const { data: reply } = await supabase
    .from("post_replies")
    .select(
      "id, post_id, body, media_type, media_path, created_at, reply_to_user_id, parent_reply_id, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), likes(count)",
    )
    .eq("id", replyId)
    .single();

  // Same ambiguity as the post page: an invisible reply may be gated rather
  // than absent. Checked before the mismatch guard below, since a gated
  // reply reads as missing and would otherwise fall through to a 404.
  if (!reply) {
    const gated = await gatedContextForPost(postId);
    if (gated) {
      return (
        <SignInToView
          gated={gated}
          returnTo={`/networks/${id}/posts/${postId}/replies/${replyId}`}
        />
      );
    }
    notFound();
  }

  // Guard against a reply id that exists but belongs to a different post:
  // the URL would otherwise render a reply under an unrelated post.
  if (String(reply.post_id) !== String(postId)) {
    notFound();
  }

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, body, video_url, media_type, media_path, created_at, network_id, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), likes(count)",
    )
    .eq("id", postId)
    .single();

  if (!post || String(post.network_id) !== String(id)) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: network }, { data: myLikes }, postMediaUrl, replyMediaUrl] = await Promise.all([
    supabase.from("networks").select("title").eq("id", post.network_id).single(),
    user
      ? supabase.from("likes").select("post_id, reply_id").eq("user_id", user.id)
      : Promise.resolve({ data: null }),
    getPostMediaUrl(post.media_path),
    getPostMediaUrl(reply.media_path),
  ]);

  const myLikedPostIds = new Set((myLikes ?? []).map((l) => l.post_id).filter(Boolean));
  const myLikedReplyIds = new Set((myLikes ?? []).map((l) => l.reply_id).filter(Boolean));

  const postAuthor = post.author as unknown as Author | null;
  const postAvatarUrl = postAuthor ? getAvatarUrl(supabase, postAuthor.img_path) : null;
  const replyAuthor = reply.author as unknown as Author | null;

  const { data: mentioned } = reply.reply_to_user_id
    ? await supabase
        .from("profiles")
        .select("id, username, first_name, last_name")
        .eq("id", reply.reply_to_user_id)
        .maybeSingle()
    : { data: null };

  const replyView: ReplyView = {
    id: reply.id,
    body: reply.body,
    createdAt: reply.created_at,
    author: replyAuthor
      ? {
          id: replyAuthor.id,
          name: getDisplayName(replyAuthor),
          avatarUrl: getAvatarUrl(supabase, replyAuthor.img_path),
        }
      : null,
    isMine: user?.id === replyAuthor?.id,
    media:
      reply.media_type && replyMediaUrl
        ? { type: reply.media_type as "audio" | "video", url: replyMediaUrl }
        : null,
    likeCount: extractCount(reply.likes),
    liked: myLikedReplyIds.has(reply.id),
    transcript: reply.transcript,
    transcriptLanguage: reply.transcript_language,
    hasCaptions: Boolean(reply.transcript_segments),
    summary: reply.summary_text
      ? {
          text: reply.summary_text,
          language:
            (reply.summary_language as unknown as { iso_code: string | null } | null)?.iso_code ??
            null,
        }
      : null,
    permalink: `/networks/${id}/posts/${postId}/replies/${replyId}`,
    replyTo: mentioned
      ? { id: mentioned.id as string, name: getDisplayName(mentioned as unknown as Author) }
      : null,
    parentReplyId: (reply.parent_reply_id as number | null) ?? null,
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <Link
          href={`/networks/${id}/posts/${postId}${embedSuffix}`}
          className="text-sm text-muted underline hover:text-primary"
        >
          ← {t("backToPost")}
        </Link>
        {network?.title && <h1 className="text-lg font-medium text-ink">{network.title}</h1>}
      </div>

      {/* The post being replied to, for context. */}
      <div className="flex gap-3 border-b border-border pb-4">
        {postAvatarUrl ? (
          <Image
            src={postAvatarUrl}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 shrink-0 rounded-full bg-border" />
        )}
        <div className="flex flex-1 flex-col gap-1">
          <Link
            href={postAuthor ? `/profile/${postAuthor.id}` : "#"}
            className="text-sm font-medium text-ink underline hover:text-primary"
          >
            {postAuthor ? getDisplayName(postAuthor) : t("someone")}
          </Link>
          <EditableEntry
            kind="post"
            itemId={post.id}
            body={post.body}
            media={
              post.media_type && postMediaUrl
                ? { type: post.media_type as "audio" | "video", url: postMediaUrl }
                : null
            }
            createdAt={post.created_at}
            canModify={user?.id === postAuthor?.id}
            likeCount={extractCount(post.likes)}
            liked={myLikedPostIds.has(post.id)}
            transcript={post.transcript}
            transcriptLanguage={post.transcript_language}
            hasCaptions={Boolean(post.transcript_segments)}
            summary={
              post.summary_text
                ? {
                    text: post.summary_text,
                    language:
                      (post.summary_language as unknown as { iso_code: string | null } | null)
                        ?.iso_code ?? null,
                  }
                : null
            }
            permalink={`/networks/${id}/posts/${postId}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 pl-8">
        <ReplyRow reply={replyView} someoneLabel={t("someone")} />

        {/* Only this one reply is shown, so the way to the rest of the
            conversation has to be explicit. */}
        <Link
          href={`/networks/${id}/posts/${postId}${embedSuffix}`}
          className="self-start text-sm text-primary underline"
        >
          {t("showAllReplies")}
        </Link>
      </div>

      {/* Replying from here answers the reply you followed the link to,
          which is the only thing on the page. */}
      <ReplySection
        networkId={id}
        postId={postId}
        replies={[]}
        someoneLabel={t("someone")}
        isEmbedded={embed === "1"}
        canReply={Boolean(user)}
        signInHref={`/sign-in?returnTo=${encodeURIComponent(`/networks/${id}/posts/${postId}/replies/${replyId}`)}`}
        bodyLabel={t("replyLabel")}
        bodyPlaceholder={t("replyPlaceholder")}
        submitLabel={t("replySubmit")}
        isSignedLanguage={false}
        initialReplyTo={
          replyView.author ? { ...replyView.author, replyId: replyView.id } : null
        }
      />
    </div>
  );
}
