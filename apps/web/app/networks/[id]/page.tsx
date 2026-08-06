import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { createPost, joinNetwork, leaveNetwork } from "@/app/networks/actions";

export default async function NetworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
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
        "id, body, video_url, created_at, author:user_id(id, username, first_name, last_name, img_path)",
      )
      .eq("network_id", network.id)
      .order("created_at", { ascending: false }),
  ]);

  const originName = language?.name ?? originPlace?.name ?? "?";
  const isMember = Boolean(membership);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">{network.title}</h1>
        <p className="text-sm text-zinc-600">
          {originName} in {location?.name ?? "?"}
        </p>
      </div>

      <p className="text-sm text-zinc-600">
        {network.member_count} members, {network.post_count} posts
      </p>

      <Link href={`/networks/${network.id}/events`} className="text-sm underline">
        Events
      </Link>

      {user ? (
        <form action={isMember ? leaveNetwork : joinNetwork}>
          <input type="hidden" name="networkId" value={network.id} />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            {isMember ? "Leave network" : "Join network"}
          </button>
        </form>
      ) : (
        <a href="/sign-in" className="text-sm underline">
          Sign in to join
        </a>
      )}

      <div className="flex flex-col gap-4 border-t pt-6">
        {isMember && (
          <form action={createPost} className="flex flex-col gap-2">
            <input type="hidden" name="networkId" value={network.id} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <textarea
              name="body"
              placeholder="Share something with this network..."
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="videoUrl"
              placeholder="Video link (optional)"
              className="rounded border px-3 py-2"
            />
            <button type="submit" className="self-start rounded bg-black px-3 py-2 text-white">
              Post
            </button>
          </form>
        )}

        <div className="flex flex-col gap-4">
          {posts?.map((post) => {
            const author = post.author as unknown as Author | null;
            const avatarUrl = author ? getAvatarUrl(supabase, author.img_path) : null;

            return (
              <div key={post.id} className="flex gap-3 border-b pb-4">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200" />
                )}
                <div className="flex flex-col gap-1">
                  <Link
                    href={author ? `/profile/${author.id}` : "#"}
                    className="text-sm font-medium underline"
                  >
                    {author ? getDisplayName(author) : "Someone"}
                  </Link>
                  <p>{post.body}</p>
                  {post.video_url && (
                    <a
                      href={post.video_url}
                      className="text-sm text-blue-600 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {post.video_url}
                    </a>
                  )}
                  <Link
                    href={`/networks/${network.id}/posts/${post.id}`}
                    className="text-sm text-zinc-500 underline"
                  >
                    Replies
                  </Link>
                </div>
              </div>
            );
          })}
          {posts?.length === 0 && (
            <p className="text-sm text-zinc-500">No posts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
