// Run with: npm run test
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEED_REPLIES, FEED_REPLIES_WHEN_MEDIA, feedReplySlice } from "./feed-replies";

const text = (id: number) => ({ id, media: null });
const audio = (id: number) => ({ id, media: { type: "audio", url: "u" } });
const video = (id: number) => ({ id, media: { type: "video", url: "u" } });

test("empty thread shows nothing", () => {
  assert.deepEqual(feedReplySlice([]), []);
});

test("text replies: shows the newest three", () => {
  const replies = [text(5), text(4), text(3), text(2), text(1)];
  assert.deepEqual(
    feedReplySlice(replies).map((r) => r.id),
    [5, 4, 3],
  );
});

test("text replies: fewer than three shows all of them", () => {
  assert.deepEqual(
    feedReplySlice([text(2), text(1)]).map((r) => r.id),
    [2, 1],
  );
});

test("newest reply is audio: shows only that one", () => {
  const replies = [audio(5), text(4), text(3), text(2)];
  assert.deepEqual(
    feedReplySlice(replies).map((r) => r.id),
    [5],
  );
});

test("newest reply is video: shows only that one", () => {
  assert.deepEqual(
    feedReplySlice([video(9), text(8), text(7)]).map((r) => r.id),
    [9],
  );
});

test("media further down does NOT shrink the slice - only the newest decides", () => {
  // The rule is about what lands at the top of the feed, so a recording
  // buried third still shows alongside two lines of text.
  const replies = [text(5), text(4), video(3), text(2)];
  assert.deepEqual(
    feedReplySlice(replies).map((r) => r.id),
    [5, 4, 3],
  );
});

test("limits are the documented ones", () => {
  assert.equal(FEED_REPLIES, 3);
  assert.equal(FEED_REPLIES_WHEN_MEDIA, 1);
});
