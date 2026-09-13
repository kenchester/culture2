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
  /** Set when this reply answers another reply rather than the post. */
  replyTo: { id: string; name: string } | null;
};

/** How many replies show before the rest are folded away. */
export const VISIBLE_REPLIES = 3;

/**
 * One reply. Shared by the thread below, the network feed, and the
 * single-reply permalink page, so a reply looks the same wherever it is.
 *
 * The Reply control is either a callback (on a page that has a composer to
 * focus) or a link (in the network feed, where replying means going to the
 * post first) - never both.
 */
export function ReplyRow({
  reply,
  someoneLabel,
  onReply,
  replyHref,
}: {
  reply: ReplyView;
  someoneLabel: string;
  onReply?: (target: { id: string; name: string }) => void;
  replyHref?: string;
}) {
  const t = useTranslations("postDetail");
  const target = reply.author ? { id: reply.author.id, name: reply.author.name } : null;

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
      <div className="flex min-w-0 flex-1 flex-col gap-1">
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
          mention={reply.replyTo}
        />
        {target && onReply && (
          <button
            type="button"
            onClick={() => onReply(target)}
            className="self-start text-sm text-muted underline hover:text-primary"
          >
            {t("reply")}
          </button>
        )}
        {target && !onReply && replyHref && (
          <Link href={replyHref} className="self-start text-sm text-muted underline hover:text-primary">
            {t("reply")}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * A post's replies: the most recent few, with the rest folded away.
 *
 * A post with forty replies otherwise buries the post someone followed a
 * link to read. The thread still reads in chronological order, so expanding
 * inserts the older replies above rather than appending below - and it
 * collapses again, because an expand with no way back is a one-way door on
 * a page you may only have wanted to glance at.
 */
export function ReplyThread({
  replies,
  someoneLabel,
  onReply,
  replyHrefFor,
}: {
  replies: ReplyView[];
  someoneLabel: string;
  onReply?: (target: { id: string; name: string }) => void;
  replyHrefFor?: (reply: ReplyView) => string;
}) {
  const t = useTranslations("postDetail");
  const [expanded, setExpanded] = useState(false);

  const hiddenCount = Math.max(0, replies.length - VISIBLE_REPLIES);
  const shown = expanded ? replies : replies.slice(-VISIBLE_REPLIES);

  return (
    <div className="flex flex-col gap-4">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm text-primary underline"
        >
          {expanded ? t("showLessReplies") : t("loadMoreReplies")}
        </button>
      )}

      {shown.map((reply) => (
        <ReplyRow
          key={reply.id}
          reply={reply}
          someoneLabel={someoneLabel}
          onReply={onReply}
          replyHref={replyHrefFor?.(reply)}
        />
      ))}

      {replies.length === 0 && <p className="text-sm text-muted">{t("noRepliesYet")}</p>}
    </div>
  );
}
