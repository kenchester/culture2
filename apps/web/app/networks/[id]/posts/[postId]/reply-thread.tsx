"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EditableEntry } from "@/app/networks/editable-entry";

export type ReplyView = {
  id: number;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  isMine: boolean;
  media: { type: "audio" | "video"; url: string } | null;
  likeCount: number;
  liked: boolean;
  transcript: string | null;
  transcriptLanguage: string | null;
  hasCaptions: boolean;
  summary: { text: string; language: string | null } | null;
  permalink: string;
};

/** How many replies show before the rest are folded away. */
const VISIBLE_REPLIES = 3;

/**
 * One reply. Shared by the collapsing thread below and by the single-reply
 * permalink page, so a reply looks identical whether it's in context or on
 * its own.
 */
export function ReplyRow({ reply, someoneLabel }: { reply: ReplyView; someoneLabel: string }) {
  return (
    <div className="flex gap-3">
      {reply.author?.avatarUrl ? (
        <Image
          src={reply.author.avatarUrl}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="h-6 w-6 shrink-0 rounded-full bg-border" />
      )}
      <div className="flex flex-1 flex-col gap-1">
        <Link
          href={reply.author ? `/profile/${reply.author.id}` : "#"}
          className="text-sm font-medium text-ink underline hover:text-primary"
        >
          {reply.author ? reply.author.name : someoneLabel}
        </Link>
        <EditableEntry
          kind="reply"
          itemId={reply.id}
          body={reply.body}
          media={reply.media}
          createdAt={reply.createdAt}
          canModify={reply.isMine}
          likeCount={reply.likeCount}
          liked={reply.liked}
          transcript={reply.transcript}
          transcriptLanguage={reply.transcriptLanguage}
          hasCaptions={reply.hasCaptions}
          summary={reply.summary}
          permalink={reply.permalink}
        />
      </div>
    </div>
  );
}

/**
 * A post's replies, newest few first-class and the rest folded behind a
 * control - the shape Facebook uses, and the reason is the same: a post
 * with forty replies is otherwise a wall that buries the post someone
 * followed a link to read.
 *
 * The three shown are the three most RECENT, but the thread still reads in
 * chronological order, so expanding inserts the older replies above rather
 * than appending below. Every reply is already loaded; this only controls
 * what's drawn. Threads here are small, and paying one round trip to hide
 * three rows would be a worse trade than the markup.
 */
export function ReplyThread({
  replies,
  someoneLabel,
}: {
  replies: ReplyView[];
  someoneLabel: string;
}) {
  const t = useTranslations("postDetail");
  const [expanded, setExpanded] = useState(false);

  const hiddenCount = Math.max(0, replies.length - VISIBLE_REPLIES);
  const shown = expanded ? replies : replies.slice(-VISIBLE_REPLIES);

  return (
    <div className="flex flex-col gap-4 pl-8">
      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-sm text-primary underline hover:text-primary"
        >
          {t("loadMoreReplies")}
        </button>
      )}

      {shown.map((reply) => (
        <ReplyRow key={reply.id} reply={reply} someoneLabel={someoneLabel} />
      ))}

      {replies.length === 0 && <p className="text-sm text-muted">{t("noRepliesYet")}</p>}
    </div>
  );
}
