// Deliberately free of "server-only": this is pure display logic with no
// data access, and keeping it importable means it can be unit-tested.
// lib/post-views.ts re-exports it so callers have one place to look.

// The most replies shown inline under a post in the network feed.
export const FEED_REPLIES = 3;

/**
 * The slice of a thread that shows inline in the feed.
 *
 * `replies` must be newest-first, which is how the feed orders them.
 *
 * An audio or video player is several times the height of a line of text,
 * so a recording is only ever shown out here when it is the newest reply -
 * the one thing worth surfacing. Anywhere further down it is cut, along
 * with everything below it, and the text above it is shown instead:
 *
 *   newest is a recording   -> just that one
 *   2nd is a recording      -> just the 1st
 *   3rd is a recording      -> the 1st and 2nd
 *   no recordings           -> three
 *
 * Cutting at the recording rather than skipping past it keeps the feed
 * chronological. Showing replies 1 and 3 while silently dropping 2 would
 * read as a conversation with a hole in it, and the full thread is one
 * click away regardless.
 */
export function feedReplySlice<T extends { media: unknown | null }>(replies: T[]): T[] {
  if (replies.length === 0) return [];
  if (replies[0].media) return replies.slice(0, 1);

  const window = replies.slice(0, FEED_REPLIES);
  const firstMedia = window.findIndex((reply) => reply.media);
  return firstMedia === -1 ? window : window.slice(0, firstMedia);
}
