"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EditableEntry } from "@/app/networks/editable-entry";
import { loadMorePosts } from "@/app/networks/actions";
import type { PostCursor, PostView } from "@/lib/post-views";

// Mirrors POSTS_PREFETCH_MARGIN in lib/post-views.ts. Kept as a prop rather
// than imported so this file never pulls in a "server-only" module.
export function PostFeed({
  networkId,
  initialPosts,
  initialCursor,
  hasMore: initialHasMore,
  prefetchMargin,
  embedSuffix,
}: {
  networkId: number;
  initialPosts: PostView[];
  initialCursor: PostCursor | null;
  hasMore: boolean;
  prefetchMargin: number;
  embedSuffix: string;
}) {
  const t = useTranslations("network");
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Guards against a second request firing while one is in flight. State
  // alone can't: the observer callback closes over the render it was
  // created in, so it would still see loading === false.
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore || !cursor) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const next = await loadMorePosts(networkId, cursor);
      setPosts((current) => {
        // The server can only return posts strictly older than the cursor,
        // but a post deleted between pages could still let one repeat, and
        // React would warn about duplicate keys rather than fail loudly.
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...next.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    } catch {
      // Leave hasMore alone so the next scroll retries rather than
      // stranding the feed on a half-loaded list.
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore, networkId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      // A little lookahead beyond the sentinel's own position, so a fast
      // scroll still has a chance to start the request before it lands.
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // Sits `prefetchMargin` posts from the end, so loading starts well before
  // the reader gets there.
  const sentinelIndex = Math.max(0, posts.length - prefetchMargin);

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post, index) => (
        // The ref goes on a real post row, not a separate empty spacer.
        // An empty <div /> in this flex column resolves to height 0, and
        // IntersectionObserver never fires for a zero-area target - not
        // even the initial callback it normally delivers on observe() - so
        // the feed silently never loaded a second page.
        <div key={post.id} ref={index === sentinelIndex ? sentinelRef : undefined}>
          <div className="flex gap-3 border-b border-border pb-4">
            {post.author?.avatarUrl ? (
              <Image
                src={post.author.avatarUrl}
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
                href={post.author ? `/profile/${post.author.id}` : "#"}
                className="text-sm font-medium text-ink underline hover:text-primary"
              >
                {post.author ? post.author.name : t("someone")}
              </Link>
              <EditableEntry
                kind="post"
                itemId={post.id}
                body={post.body}
                media={post.media}
                createdAt={post.createdAt}
                canModify={post.isMine}
                likeCount={post.likeCount}
                liked={post.liked}
                transcript={post.transcript}
                transcriptLanguage={post.transcriptLanguage}
                hasCaptions={post.hasCaptions}
                summary={post.summary}
                permalink={`/networks/${networkId}/posts/${post.id}`}
              />
              {post.videoUrl && (
                <a
                  href={post.videoUrl}
                  className="text-sm text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {post.videoUrl}
                </a>
              )}
              <Link
                href={`/networks/${networkId}/posts/${post.id}${embedSuffix}`}
                className="text-sm text-muted underline hover:text-primary"
              >
                {post.replyCount === 0
                  ? t("replyLabel.zero")
                  : post.replyCount === 1
                    ? t("replyLabel.one")
                    : t("replyLabel.other", { count: post.replyCount })}
              </Link>
            </div>
          </div>
        </div>
      ))}

      {posts.length === 0 && <p className="text-sm text-muted">{t("noPostsYet")}</p>}

      {/* The spinner only appears while a fetch is actually outstanding.
          Scrolling at a readable pace trips the sentinel early enough that
          the next page has already arrived, so most people never see it -
          the same as X. */}
      {loading && (
        <div className="flex justify-center py-4" role="status" aria-live="polite">
          <span
            className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="sr-only">{t("loadingMorePosts")}</span>
        </div>
      )}

      {/* Scroll position is not an accessible way to ask for more content.
          A keyboard user tabbing through the feed never triggers the
          observer, and neither does anyone whose browser withholds it -
          IntersectionObserver is driven by rendered frames, so a tab that
          isn't painting delivers no callbacks at all. The button is the
          real control; the observer is a convenience layered on top that
          usually presses it first. */}
      {hasMore && !loading && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="self-center rounded-md px-3 py-1.5 text-sm text-primary underline hover:bg-primary-light"
        >
          {t("loadMorePosts")}
        </button>
      )}
    </div>
  );
}
