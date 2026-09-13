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
 * VIDEO only. A video player is several times the height of a line of
 * text, so one is shown out here only when it is the newest reply - the
 * one thing worth surfacing. Anywhere further down it is cut, along with
 * everything below it, and the text above it is shown instead:
 *
 *   newest is a video   -> just that one
 *   2nd is a video      -> just the 1st
 *   3rd is a video      -> the 1st and 2nd
 *   no videos           -> three
 *
 * Audio is deliberately exempt: an audio player is about the height of a
 * line of text, so three of them cost the feed nothing.
 *
 * Cutting at the video rather than skipping past it keeps the feed
 * chronological. Showing replies 1 and 3 while silently dropping 2 would
 * read as a conversation with a hole in it, and the full thread is one
 * click away regardless.
 */
type MediaShape = { media: { type: string } | null };

function isVideo(reply: MediaShape): boolean {
  return reply.media?.type === "video";
}

export function feedReplySlice<T extends MediaShape>(replies: T[]): T[] {
  if (replies.length === 0) return [];
  if (isVideo(replies[0])) return replies.slice(0, 1);

  const window = replies.slice(0, FEED_REPLIES);
  const firstVideo = window.findIndex(isVideo);
  return firstVideo === -1 ? window : window.slice(0, firstVideo);
}
