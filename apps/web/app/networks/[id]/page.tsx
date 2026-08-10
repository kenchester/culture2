import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { createPost, joinNetwork, leaveNetwork } from "@/app/networks/actions";
import { EditableEntry } from "@/app/networks/editable-entry";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";

function replyLabel(count: number): string {
  if (count === 0) return "Reply";
  if (count === 1) return "1 Reply";
  return `${count} Replies`;
}

export default async function NetworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; embed?: string }>;
}) {
  const { id } = await params;
  const { error, embed } = await searchParams;
  const isEmbedded = embed === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: network } = await supabase
    .from("networks")
    .select(
      "id, title, member_count, post_count, language_id, origin_place_id, location_place_id",
    )
    .eq("id", id)
    .single();

  if (!network) {
    notFound();
  }

  const [
    { data: language },
    { data: originPlace },
    { data: location },
    { data: membership },
    { data: posts },
  ] = await Promise.all([
    network.language_id
      ? supabase.from("languages").select("name").eq("id", network.language_id).single()
      : Promise.resolve({ data: null }),
    network.origin_place_id
      ? supabase.from("places").select("name").eq("id", network.origin_place_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("places").select("name, type").eq("id", network.location_place_id).single(),
    user
      ? supabase
          .from("network_members")
          .select("user_id")
          .eq("network_id", network.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("posts")
      .select(
        "id, body, video_url, created_at, author:user_id(id, username, first_name, last_name, img_path), post_replies(count)",
      )
      .eq("network_id", network.id)
      .order("created_at", { ascending: false }),
  ]);

  const originName = language?.name ?? originPlace?.name ?? "?";
  const isMember = Boolean(membership);

  const returnTo = `/networks/${network.id}${isEmbedded ? "?embed=1" : ""}`;
  const signInParams = new URLSearchParams({ returnTo });
  if (isEmbedded) signInParams.set("embed", "1");
  const signInHref = `/sign-in?${signInParams.toString()}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-3xl text-ink">{network.title}</h1>
        <p className="text-sm text-muted">
          {originName} in {location?.name ?? "?"}
        </p>
      </div>

      <p className="text-sm text-muted">
        {network.member_count} members, {network.post_count} posts
      </p>

      <Link
        href={`/networks/${network.id}/events${isEmbedded ? "?embed=1" : ""}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        Events
      </Link>

      {user ? (
        <form action={isMember ? leaveNetwork : joinNetwork}>
          <input type="hidden" name="networkId" value={network.id} />
          {isEmbedded && <input type="hidden" name="embed" value="1" />}
          <Button type="submit">{isMember ? "Leave network" : "Join network"}</Button>
        </form>
      ) : (
        <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
          Sign in to join
        </Link>
      )}

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        {isMember && (
          <form action={createPost} className="flex flex-col gap-2">
            <input type="hidden" name="networkId" value={network.id} />
            {isEmbedded && <input type="hidden" name="embed" value="1" />}
            {error && (
              <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
            )}
            <Field>
              <Label htmlFor="post-body">Post</Label>
              <Textarea
                id="post-body"
                name="body"
                placeholder="Share something with this network..."
                required
              />
            </Field>
            <Button type="submit" className="self-start">
              Post
            </Button>
          </form>
        )}

        <div className="flex flex-col gap-4">
          {posts?.map((post) => {
            const author = post.author as unknown as Author | null;
            const avatarUrl = author ? getAvatarUrl(supabase, author.img_path) : null;
            const replyCount =
              (post.post_replies as unknown as { count: number } | { count: number }[] | null) ??
              { count: 0 };
            const replyCountValue = Array.isArray(replyCount)
              ? (replyCount[0]?.count ?? 0)
              : replyCount.count;

            return (
              <div key={post.id} className="flex gap-3 border-b border-border pb-4">
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
                    {author ? getDisplayName(author) : "Someone"}
                  </Link>
                  <EditableEntry
                    kind="post"
                    itemId={post.id}
                    body={post.body}
                    canModify={user?.id === author?.id}
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
                  <Link
                    href={`/networks/${network.id}/posts/${post.id}${isEmbedded ? "?embed=1" : ""}`}
                    className="text-sm text-muted underline hover:text-primary"
                  >
                    {replyLabel(replyCountValue)}
                  </Link>
                </div>
              </div>
            );
          })}
          {posts?.length === 0 && <p className="text-sm text-muted">No posts yet.</p>}
        </div>
      </div>
    </div>
  );
}
