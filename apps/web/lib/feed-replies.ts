// Deliberately free of "server-only": this is pure display logic with no
// data access, and keeping it importable means it can be unit-tested.
// lib/post-views.ts re-exports it so callers have one place to look.

// How many of a post's replies show inline in the network feed.
//
// Three for text. One when the newest reply is a recording, because an
// audio or video player takes several times the vertical space of a line
// of text - three in a row pushes the next post off the screen entirely
// and turns the feed into a list of players rather than a conversation.
export const FEED_REPLIES = 3;
export const FEED_REPLIES_WHEN_MEDIA = 1;

/**
 * The slice of a thread that shows inline in the feed.
 *
 * `replies` must be newest-first, which is how the feed orders them, so
 * the deciding reply is the one at the front.
 */
export function feedReplySlice<T extends { media: unknown | null }>(replies: T[]): T[] {
  if (replies.length === 0) return [];
  const limit = replies[0].media ? FEED_REPLIES_WHEN_MEDIA : FEED_REPLIES;
  return replies.slice(0, limit);
}
