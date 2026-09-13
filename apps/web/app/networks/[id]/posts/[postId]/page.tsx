import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { gatedContextForPost } from "@/lib/gated-access";
import { SignInToView } from "@/components/sign-in-to-view";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getPostMediaUrl } from "@/lib/post-media";
import { demoPostTimestamp, isExampleNetwork } from "@/lib/demo-network";
import { EditableEntry } from "@/app/networks/editable-entry";
import { DemoReplyThread, type RealDemoReply } from "@/app/networks/[id]/posts/[postId]/demo-reply-thread";
import { type ReplyView } from "@/app/networks/[id]/posts/[postId]/reply-thread";
import { ReplySection } from "@/app/networks/[id]/posts/[postId]/reply-section";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; postId: string }>;
  searchParams: Promise<{ error?: string; embed?: string; replyTo?: string }>;
}) {
  const { id, postId } = await params;
  const { error, embed, replyTo } = await searchParams;
  const isEmbedded = embed === "1";
  const embedSuffix = isEmbedded ? "?embed=1" : "";
  const supabase = await createClient();
  const t = await getTranslations("postDetail");

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, body, video_url, media_type, media_path, created_at, network_id, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), likes(count)",
    )
    .eq("id", postId)
    .single();

  // A miss here is ambiguous: the post may not exist, or RLS may be hiding
  // a school post from someone who isn't in that network
  // (00000000000078). Only the second case is recoverable, and the reader
  // can't tell the difference without being told.
  if (!post) {
    const gated = await gatedContextForPost(postId);
    if (gated) {
      return <SignInToView gated={gated} returnTo={`/networks/${id}/posts/${postId}`} />;
    }
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: replies }, { data: myLikes }, { data: network }] = await Promise.all([
    supabase
      .from("post_replies")
      .select(
        "id, body, media_type, media_path, created_at, reply_to_user_id, parent_reply_id, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), likes(count)",
      )
      .eq("post_id", postId)
      // Newest first, matching the post feed. ReplyThread regroups these
      // into top-level replies plus their batches.
      .order("created_at", { ascending: false }),
    user
      ? supabase.from("likes").select("post_id, reply_id").eq("user_id", user.id)
      : Promise.resolve({ data: null }),
    supabase
      .from("networks")
      .select("title, location_place_id, language:languages(is_signed)")
      .eq("id", post.network_id)
      .single(),
  ]);

  const isExample = network ? await isExampleNetwork(supabase, network.location_place_id) : false;

  // This post's own displayed timestamp has to land on the same "today"/
  // "yesterday" it shows as in the network's main feed (app/networks/
  // [id]/page.tsx) - that page derives it from the post's position among
  // all of the network's posts (newest first), so this fetches the same
  // ordering to find this post's rank in it. Skipped entirely for real
  // networks, where the real created_at is just used as-is.
  let postRankIndex = 0;
  let postRankTotal = 1;
  if (isExample) {
    const { data: networkPosts } = await supabase
      .from("posts")
      .select("id")
      .eq("network_id", post.network_id)
      .order("created_at", { ascending: false });
    postRankTotal = networkPosts?.length ?? 1;
    postRankIndex = Math.max(0, networkPosts?.findIndex((p) => p.id === post.id) ?? 0);
  }

  const myLikedPostIds = new Set((myLikes ?? []).map((l) => l.post_id).filter(Boolean));
  const myLikedReplyIds = new Set((myLikes ?? []).map((l) => l.reply_id).filter(Boolean));

  function extractCount(value: unknown): number {
    const count = (value as { count: number } | { count: number }[] | null) ?? { count: 0 };
    return Array.isArray(count) ? (count[0]?.count ?? 0) : count.count;
  }

  const author = post.author as unknown as Author | null;
  const avatarUrl = author ? getAvatarUrl(supabase, author.img_path) : null;

  // Signed URLs (post-media is private, 00000000000065) resolved once up
  // front for the post itself and every reply, same reasoning as
  // app/networks/[id]/page.tsx's postMediaUrls.
  const [postMediaUrl, replyMediaUrls] = await Promise.all([
    getPostMediaUrl(post.media_path),
    Promise.all(
      (replies ?? []).map(async (reply) => [reply.id, await getPostMediaUrl(reply.media_path)] as const),
    ).then((entries) => new Map(entries)),
  ]);

  // ?replyTo=<replyId> is set when someone pressed Reply on a reply out in
  // the network feed, where there is no composer to focus. Resolved here to
  // the person being answered, so arriving on this page keeps the intent
  // they already expressed instead of quietly dropping it.
  const replyTarget = replyTo
    ? (replies ?? []).find((r) => String(r.id) === String(replyTo))
    : undefined;
  const replyTargetAuthor = replyTarget?.author as unknown as Author | null;
  const initialReplyTo = replyTargetAuthor
    ? { id: replyTargetAuthor.id, name: getDisplayName(replyTargetAuthor) }
    : null;

  // One lookup for the whole thread rather than a join per reply: the
  // people being answered are almost always already in it.
  const mentionIds = [
    ...new Set((replies ?? []).map((r) => r.reply_to_user_id).filter(Boolean)),
  ] as string[];
  const { data: mentionedProfiles } = mentionIds.length
    ? await supabase.from("profiles").select("id, username, first_name, last_name").in("id", mentionIds)
    : { data: [] };
  const mentionNameById = new Map(
    (mentionedProfiles ?? []).map((p) => [p.id as string, getDisplayName(p as unknown as Author)]),
  );
  const replyMentions = new Map(
    (replies ?? [])
      .filter((r) => r.reply_to_user_id && mentionNameById.has(r.reply_to_user_id))
      .map((r) => [
        r.id as number,
        { id: r.reply_to_user_id as string, name: mentionNameById.get(r.reply_to_user_id)! },
      ]),
  );

  const replyViews: ReplyView[] = (replies ?? []).map((reply) => {
    const replyAuthor = reply.author as unknown as Author | null;
    const replyMediaUrl = replyMediaUrls.get(reply.id);
    return {
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
      permalink: `/networks/${id}/posts/${postId}/replies/${reply.id}`,
      replyTo: replyMentions.get(reply.id) ?? null,
      parentReplyId: (reply.parent_reply_id as number | null) ?? null,
    };
  });

  const isSignedLanguage = Boolean(
    (network?.language as unknown as { is_signed?: boolean } | null)?.is_signed,
  );

  const returnTo = `/networks/${id}/posts/${postId}${embedSuffix}`;
  const signInParams = new URLSearchParams({ returnTo });
  if (isEmbedded) signInParams.set("embed", "1");
  const signInHref = `/sign-in?${signInParams.toString()}`;

  // Same plain-serializable-array handoff as app/networks/[id]/page.tsx's
  // realDemoPosts, for Acme's ephemeral reply thread (DemoReplyThread).
  const realDemoReplies: RealDemoReply[] = isExample
    ? (replies ?? []).map((reply, replyIndex) => {
        const replyAuthor = reply.author as unknown as Author | null;
        return {
          id: reply.id,
          body: reply.body,
          media:
            reply.media_type && replyMediaUrls.get(reply.id)
              ? { type: reply.media_type as "audio" | "video", url: replyMediaUrls.get(reply.id)! }
              : null,
          createdAt: demoPostTimestamp(replyIndex, replies?.length ?? 1, false),
          authorName: replyAuthor ? getDisplayName(replyAuthor) : t("someone"),
          authorHref: replyAuthor ? `/profile/${replyAuthor.id}` : "#",
          avatarUrl: replyAuthor ? getAvatarUrl(supabase, replyAuthor.img_path) : null,
        };
      })
    : [];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      {/* Someone arriving on a shared link has no other way to tell what
          they are looking at, so the network is named here and the arrow
          leads out to it. */}
      <div className="flex flex-col gap-1">
        <Link
          href={`/networks/${id}${embedSuffix}`}
          className="text-sm text-muted underline hover:text-primary"
        >
          ← {t("backToNetwork")}
        </Link>
        {network?.title && (
          <h1 className="text-lg font-medium text-ink">{network.title}</h1>
        )}
      </div>

      <div className="flex gap-3 border-b border-border pb-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
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
            href={author ? `/profile/${author.id}` : "#"}
            className="text-sm font-medium text-ink underline hover:text-primary"
          >
            {author ? getDisplayName(author) : t("someone")}
          </Link>
          <EditableEntry
            kind="post"
            itemId={post.id}
            body={post.body}
            media={post.media_type && postMediaUrl ? { type: post.media_type as "audio" | "video", url: postMediaUrl } : null}
            createdAt={
              isExample ? demoPostTimestamp(postRankIndex, postRankTotal, true) : post.created_at
            }
            canModify={user?.id === author?.id}
            likeCount={extractCount(post.likes)}
            liked={myLikedPostIds.has(post.id)}
            redirectAfterDelete={`/networks/${id}${embedSuffix}`}
            permalink={`/networks/${id}/posts/${postId}`}
            transcript={post.transcript}
            transcriptLanguage={post.transcript_language}
            hasCaptions={Boolean(post.transcript_segments)}
            summary={
              post.summary_text
                ? {
                    text: post.summary_text,
                    language:
                      (post.summary_language as unknown as { iso_code: string | null } | null)?.iso_code ??
                      null,
                  }
                : null
            }
          />
          {post.video_url && (
            <a
              href={post.video_url}
              className="text-sm text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              {post.video_url}
            </a>
          )}
        </div>
      </div>

      {isExample ? (
        <DemoReplyThread networkId={post.network_id} realReplies={realDemoReplies} />
      ) : (
        <>
          <ReplySection
            networkId={id}
            postId={postId}
            replies={replyViews}
            someoneLabel={t("someone")}
            isEmbedded={isEmbedded}
            canReply={Boolean(user)}
            signInHref={signInHref}
            bodyLabel={t("replyLabel")}
            bodyPlaceholder={t("replyPlaceholder")}
            submitLabel={t("replySubmit")}
            isSignedLanguage={isSignedLanguage}
            error={error}
            initialReplyTo={initialReplyTo}
          />
        </>
      )}
    </div>
  );
}
