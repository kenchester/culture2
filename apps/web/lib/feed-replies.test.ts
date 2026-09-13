// Run with: npm run test
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEED_REPLIES, feedReplySlice } from "./feed-replies";

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

test("audio is exempt: an audio player is about a line tall", () => {
  assert.deepEqual(
    feedReplySlice([audio(5), text(4), text(3), text(2)]).map((r) => r.id),
    [5, 4, 3],
  );
  assert.deepEqual(
    feedReplySlice([text(5), audio(4), text(3), text(2)]).map((r) => r.id),
    [5, 4, 3],
  );
});

test("newest reply is video: shows only that one", () => {
  assert.deepEqual(
    feedReplySlice([video(9), text(8), text(7)]).map((r) => r.id),
    [9],
  );
});

test("second reply is a video: shows only the first", () => {
  assert.deepEqual(
    feedReplySlice([text(5), video(4), text(3), text(2)]).map((r) => r.id),
    [5],
  );
});

test("third reply is a video: shows the first two", () => {
  assert.deepEqual(
    feedReplySlice([text(5), text(4), video(3), text(2)]).map((r) => r.id),
    [5, 4],
  );
});

test("a video below the window is irrelevant", () => {
  // Position four is never shown anyway, so it must not affect the slice.
  assert.deepEqual(
    feedReplySlice([text(5), text(4), text(3), video(2)]).map((r) => r.id),
    [5, 4, 3],
  );
});

test("the cut is chronological - no holes", () => {
  // Replies 1 and 3 with 2 omitted would read as a conversation with a
  // gap in it, so everything below the video goes too.
  const out = feedReplySlice([text(5), video(4), text(3)]).map((r) => r.id);
  assert.ok(!out.includes(3), "must not skip past the video");
});

test("limit is the documented one", () => {
  assert.equal(FEED_REPLIES, 3);
});
