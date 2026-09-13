"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EditableEntry } from "@/app/networks/editable-entry";
import type { ReplyView } from "@/lib/post-views";

export type { ReplyView };


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
  onReply?: (target: { id: string; name: string; replyId: number }) => void;
  replyHref?: string;
}) {
  const t = useTranslations("postDetail");
  const target = reply.author
    ? { id: reply.author.id, name: reply.author.name, replyId: reply.id }
    : null;

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
 * Newest first, like the post feed - the last thing said is the thing worth
 * seeing first. The one exception is a reply that answers another reply:
 * those sit directly beneath the reply they answer rather than jumping to
 * the top, because read from the top they would quote someone who hasn't
 * appeared yet. Within that batch it is newest-first again.
 *
 * Collapsing is undoable; an expand with no way back is a one-way door on a
 * page you may only have wanted to glance at.
 */
export function ReplyThread({
  replies,
  someoneLabel,
  onReply,
  replyHrefFor,
  defaultExpanded = false,
}: {
  replies: ReplyView[];
  someoneLabel: string;
  onReply?: (target: { id: string; name: string; replyId: number }) => void;
  replyHrefFor?: (reply: ReplyView) => string;
  defaultExpanded?: boolean;
}) {
  const t = useTranslations("postDetail");
  const [expanded, setExpanded] = useState(defaultExpanded);

  // `replies` arrives newest-first. Top-level replies keep that order, and
  // each one's batch sits directly beneath it, also newest-first - so the
  // newest answer to a given reply is the first under it, and the oldest
  // furthest down. A reply can only ever be one level deep
  // (00000000000080), so this is a grouping rather than a recursion.
  const roots = replies.filter((r) => r.parentReplyId === null);
  const childrenByRoot = new Map<number, ReplyView[]>();
  for (const reply of replies) {
    if (reply.parentReplyId === null) continue;
    const batch = childrenByRoot.get(reply.parentReplyId) ?? [];
    batch.push(reply);
    childrenByRoot.set(reply.parentReplyId, batch);
  }

  // Counted in top-level replies: collapsing a group away from the reply it
  // answers would leave an orphan quoting someone who isn't on screen.
  const hiddenCount = Math.max(0, roots.length - VISIBLE_REPLIES);
  const shownRoots = expanded ? roots : roots.slice(0, VISIBLE_REPLIES);

  return (
    <div className="flex flex-col gap-4">
      {shownRoots.map((root) => (
        <div key={root.id} className="flex flex-col gap-4">
          <ReplyRow
            reply={root}
            someoneLabel={someoneLabel}
            onReply={onReply}
            replyHref={replyHrefFor?.(root)}
          />
          {(childrenByRoot.get(root.id) ?? []).length > 0 && (
            <div className="flex flex-col gap-4 border-l border-border pl-4">
              {(childrenByRoot.get(root.id) ?? []).map((child) => (
                <ReplyRow
                  key={child.id}
                  reply={child}
                  someoneLabel={someoneLabel}
                  onReply={onReply}
                  replyHref={replyHrefFor?.(child)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm text-primary underline"
        >
          {expanded ? t("showLessReplies") : t("loadMoreReplies")}
        </button>
      )}

      {replies.length === 0 && <p className="text-sm text-muted">{t("noRepliesYet")}</p>}
    </div>
  );
}
