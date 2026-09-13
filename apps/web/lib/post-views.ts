import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getPostMediaUrl } from "@/lib/post-media";

// How many posts a network's feed loads at a time. The feed used to select
// every post in the network with no limit at all, so a network with a few
// hundred posts shipped all of them - and, worse, minted a signed media URL
// for every audio and video among them - before the page could render.
export const POSTS_PAGE_SIZE = 30;

// How far from the end of the loaded list the sentinel sits. At 10, the
// next page starts loading as the 20th of 30 posts comes into view, so
// someone scrolling at a normal pace reaches the end of the list after the
// next page has already arrived and never sees a spinner. Scrolling fast
// outruns it, which is when the spinner appears - the same behaviour as X.
export const POSTS_PREFETCH_MARGIN = 10;

const POST_COLUMNS =
  "id, body, video_url, media_type, media_path, created_at, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), post_replies(count), likes(count)";

type Author = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  img_path: string | null;
};

/**
 * Everything the feed needs to draw one post, already resolved and fully
 * serializable.
 *
 * It has to be serializable because the second page and beyond come back
 * from a server action, and an action can only return plain data. Avatar
 * and media URLs are therefore resolved here, on the server: getAvatarUrl
 * needs a Supabase client and getPostMediaUrl needs the service-role client
 * to sign a private-bucket URL, neither of which can cross into the browser.
 */
export type PostView = {
  id: number;
  body: string;
  videoUrl: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  isMine: boolean;
  media: { type: "audio" | "video"; url: string } | null;
  likeCount: number;
  liked: boolean;
  replyCount: number;
  transcript: string | null;
  transcriptLanguage: string | null;
  hasCaptions: boolean;
  summary: { text: string; language: string | null } | null;
};

/** Position in the feed, for keyset pagination. */
export type PostCursor = { createdAt: string; id: number };

function countOf(value: unknown): number {
  const raw = (value as { count: number } | { count: number }[] | null) ?? { count: 0 };
  return Array.isArray(raw) ? (raw[0]?.count ?? 0) : raw.count;
}

export function cursorOf(posts: PostView[]): PostCursor | null {
  const last = posts.at(-1);
  return last ? { createdAt: last.createdAt, id: last.id } : null;
}

/**
 * One page of a network's posts, newest first.
 *
 * Paginated by keyset rather than offset. An offset shifts under you the
 * moment anyone posts: with `.range(30, 59)`, a new post arriving between
 * page one and page two pushes everything down one, so post 30 is served
 * twice and nothing is ever dropped from view - visible as a duplicated
 * post while scrolling. Seeking past a fixed (created_at, id) can't do
 * that. The id is in the key because created_at alone isn't unique; two
 * posts sharing a timestamp would straddle the boundary and one would be
 * skipped.
 */
export async function fetchPostViews(
  supabase: SupabaseClient,
  networkId: number,
  options: {
    viewerId?: string | null;
    cursor?: PostCursor | null;
    limit?: number;
  } = {},
): Promise<PostView[]> {
  const { viewerId = null, cursor = null, limit = POSTS_PAGE_SIZE } = options;

  let query = supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("network_id", networkId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data: posts, error } = await query;
  // A denied read surfaces as an error with null data, which is easy to
  // misread as "this network has no posts" - see the org-gating policies in
  // 00000000000078. Returning empty either way is right for the feed, but
  // the two are not the same thing, so the error is not swallowed silently.
  if (error) {
    console.error(`fetchPostViews(network ${networkId}):`, error.message);
    return [];
  }
  if (!posts?.length) return [];

  const likedIds = new Set<number>();
  if (viewerId) {
    const { data: likes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", viewerId)
      .in(
        "post_id",
        posts.map((p) => p.id),
      );
    for (const like of likes ?? []) likedIds.add(like.post_id as number);
  }

  // Signed URLs resolved in parallel rather than one per row during render.
  const mediaUrls = new Map(
    await Promise.all(
      posts.map(async (post) => [post.id, await getPostMediaUrl(post.media_path)] as const),
    ),
  );

  return toPostViews(supabase, posts, { viewerId, likedPostIds: likedIds, mediaUrls });
}

/**
 * Row -> PostView, with the async parts (media URLs, likes) already
 * resolved by the caller.
 *
 * Split out so the network page can reuse the rows it has already fetched
 * in its own big Promise.all instead of querying the same first page a
 * second time, while later pages go through fetchPostViews above. Both
 * paths produce identical shapes, which is what keeps the server-rendered
 * first page and the client-appended rest from drifting apart.
 */
export function toPostViews(
  supabase: SupabaseClient,
  posts: Record<string, unknown>[],
  {
    viewerId,
    likedPostIds,
    mediaUrls,
  }: {
    viewerId: string | null;
    likedPostIds: Set<number>;
    mediaUrls: Map<number, string | null>;
  },
): PostView[] {
  return posts.map((post) => {
    const author = post.author as unknown as Author | null;
    const id = post.id as number;
    const mediaUrl = mediaUrls.get(id);
    return {
      id,
      body: post.body as string,
      videoUrl: (post.video_url as string | null) ?? null,
      createdAt: post.created_at as string,
      author: author
        ? {
            id: author.id,
            name: getDisplayName(author),
            avatarUrl: getAvatarUrl(supabase, author.img_path),
          }
        : null,
      isMine: Boolean(viewerId && author?.id === viewerId),
      media:
        post.media_type && mediaUrl
          ? { type: post.media_type as "audio" | "video", url: mediaUrl }
          : null,
      likeCount: countOf(post.likes),
      liked: likedPostIds.has(id),
      replyCount: countOf(post.post_replies),
      transcript: (post.transcript as string | null) ?? null,
      transcriptLanguage: (post.transcript_language as string | null) ?? null,
      hasCaptions: Boolean(post.transcript_segments),
      summary: post.summary_text
        ? {
            text: post.summary_text as string,
            language:
              (post.summary_language as unknown as { iso_code: string | null } | null)?.iso_code ??
              null,
          }
        : null,
    };
  });
}
