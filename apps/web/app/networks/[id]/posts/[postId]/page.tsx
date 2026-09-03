import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getPostMediaUrl } from "@/lib/post-media";
import { demoPostTimestamp, isExampleNetwork } from "@/lib/demo-network";
import { createReply } from "./actions";
import { EditableEntry } from "@/app/networks/editable-entry";
import { DemoReplyThread, type RealDemoReply } from "@/app/networks/[id]/posts/[postId]/demo-reply-thread";
import { PostComposer } from "@/app/networks/[id]/post-composer";
import { PostingIndicator } from "@/components/posting-indicator";
import { FormError } from "@/components/ui/form-error";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; postId: string }>;
  searchParams: Promise<{ error?: string; embed?: string }>;
}) {
  const { id, postId } = await params;
  const { error, embed } = await searchParams;
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

  if (!post) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: replies }, { data: myLikes }, { data: network }] = await Promise.all([
    supabase
      .from("post_replies")
      .select(
        "id, body, media_type, media_path, created_at, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), likes(count)",
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    user
      ? supabase.from("likes").select("post_id, reply_id").eq("user_id", user.id)
      : Promise.resolve({ data: null }),
    supabase
      .from("networks")
      .select("location_place_id, language:languages(is_signed)")
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
      <Link href={`/networks/${id}${embedSuffix}`} className="text-sm text-muted underline">
        {t("backToNetwork")}
      </Link>

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
          <div className="flex flex-col gap-4 pl-8">
            {replies?.map((reply) => {
              const replyAuthor = reply.author as unknown as Author | null;
              const replyAvatarUrl = replyAuthor
                ? getAvatarUrl(supabase, replyAuthor.img_path)
                : null;

              return (
                <div key={reply.id} className="flex gap-3">
                  {replyAvatarUrl ? (
                    <Image
                      src={replyAvatarUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 shrink-0 rounded-full bg-border" />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <Link
                      href={replyAuthor ? `/profile/${replyAuthor.id}` : "#"}
                      className="text-sm font-medium text-ink underline hover:text-primary"
                    >
                      {replyAuthor ? getDisplayName(replyAuthor) : t("someone")}
                    </Link>
                    <EditableEntry
                      kind="reply"
                      itemId={reply.id}
                      body={reply.body}
                      media={
                        reply.media_type && replyMediaUrls.get(reply.id)
                          ? { type: reply.media_type as "audio" | "video", url: replyMediaUrls.get(reply.id)! }
                          : null
                      }
                      createdAt={reply.created_at}
                      canModify={user?.id === replyAuthor?.id}
                      likeCount={extractCount(reply.likes)}
                      liked={myLikedReplyIds.has(reply.id)}
                      transcript={reply.transcript}
                      transcriptLanguage={reply.transcript_language}
                      hasCaptions={Boolean(reply.transcript_segments)}
                      summary={
                        reply.summary_text
                          ? {
                              text: reply.summary_text,
                              language:
                                (reply.summary_language as unknown as { iso_code: string | null } | null)?.iso_code ??
                                null,
                            }
                          : null
                      }
                    />
                  </div>
                </div>
              );
            })}
            {replies?.length === 0 && <p className="text-sm text-muted">{t("noRepliesYet")}</p>}
          </div>

          {user ? (
            <form action={createReply} className="flex flex-col gap-2 border-t border-border pt-6">
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="networkId" value={id} />
              {isEmbedded && <input type="hidden" name="embed" value="1" />}
              {error && (
                <FormError>{error}</FormError>
              )}
              <PostComposer
                idPrefix="reply"
                bodyLabel={t("replyLabel")}
                bodyPlaceholder={t("replyPlaceholder")}
                submitLabel={t("replySubmit")}
                isSignedLanguage={isSignedLanguage}
              />
              <PostingIndicator />
            </form>
          ) : (
            <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
              {t("signInToReply")}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
