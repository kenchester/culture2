import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getPostMediaUrl } from "@/lib/post-media";
import { createReply } from "./actions";
import { EditableEntry } from "@/app/networks/editable-entry";
import { PostComposer } from "@/app/networks/[id]/post-composer";

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
      "id, body, video_url, media_type, media_path, created_at, network_id, author:user_id(id, username, first_name, last_name, img_path), likes(count)",
    )
    .eq("id", postId)
    .single();

  if (!post) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: replies }, { data: myLikes }] = await Promise.all([
    supabase
      .from("post_replies")
      .select(
        "id, body, media_type, media_path, created_at, author:user_id(id, username, first_name, last_name, img_path), likes(count)",
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    user
      ? supabase.from("likes").select("post_id, reply_id").eq("user_id", user.id)
      : Promise.resolve({ data: null }),
  ]);

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

  const returnTo = `/networks/${id}/posts/${postId}${embedSuffix}`;
  const signInParams = new URLSearchParams({ returnTo });
  if (isEmbedded) signInParams.set("embed", "1");
  const signInHref = `/sign-in?${signInParams.toString()}`;

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
            canModify={user?.id === author?.id}
            likeCount={extractCount(post.likes)}
            liked={myLikedPostIds.has(post.id)}
            redirectAfterDelete={`/networks/${id}${embedSuffix}`}
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
                  canModify={user?.id === replyAuthor?.id}
                  likeCount={extractCount(reply.likes)}
                  liked={myLikedReplyIds.has(reply.id)}
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
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
          )}
          <PostComposer
            idPrefix="reply"
            bodyLabel={t("replyLabel")}
            bodyPlaceholder={t("replyPlaceholder")}
            submitLabel={t("replySubmit")}
          />
        </form>
      ) : (
        <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
          {t("signInToReply")}
        </Link>
      )}
    </div>
  );
}
