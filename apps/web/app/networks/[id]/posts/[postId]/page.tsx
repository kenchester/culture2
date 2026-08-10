import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { createReply } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";
import { Linkify } from "@/lib/linkify";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; postId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, postId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, body, video_url, created_at, network_id, author:user_id(id, username, first_name, last_name, img_path)",
    )
    .eq("id", postId)
    .single();

  if (!post) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: replies } = await supabase
    .from("post_replies")
    .select(
      "id, body, created_at, author:user_id(id, username, first_name, last_name, img_path)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const author = post.author as unknown as Author | null;
  const avatarUrl = author ? getAvatarUrl(supabase, author.img_path) : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <Link href={`/networks/${id}`} className="text-sm text-muted underline">
        Back to network
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
        <div className="flex flex-col gap-1">
          <Link
            href={author ? `/profile/${author.id}` : "#"}
            className="text-sm font-medium text-ink underline hover:text-primary"
          >
            {author ? getDisplayName(author) : "Someone"}
          </Link>
          <p className="text-body">
            <Linkify text={post.body} />
          </p>
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

      <div className="flex flex-col gap-4">
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
              <div className="flex flex-col gap-1">
                <Link
                  href={replyAuthor ? `/profile/${replyAuthor.id}` : "#"}
                  className="text-sm font-medium text-ink underline hover:text-primary"
                >
                  {replyAuthor ? getDisplayName(replyAuthor) : "Someone"}
                </Link>
                <p className="text-body">
                  <Linkify text={reply.body} />
                </p>
              </div>
            </div>
          );
        })}
        {replies?.length === 0 && <p className="text-sm text-muted">No replies yet.</p>}
      </div>

      {user ? (
        <form action={createReply} className="flex flex-col gap-2 border-t border-border pt-6">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="networkId" value={id} />
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
          )}
          <Field>
            <Label htmlFor="reply-body">Reply</Label>
            <Textarea
              id="reply-body"
              name="body"
              placeholder="Write a reply..."
              required
            />
          </Field>
          <Button type="submit" className="self-start">
            Reply
          </Button>
        </form>
      ) : (
        <a href="/sign-in" className="text-sm font-medium text-primary hover:underline">
          Sign in to reply
        </a>
      )}
    </div>
  );
}
