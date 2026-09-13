"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createReply } from "@/app/networks/[id]/posts/[postId]/actions";
import { PostComposer } from "@/app/networks/[id]/post-composer";
import { PostingIndicator } from "@/components/posting-indicator";
import { FormError } from "@/components/ui/form-error";
import { ReplyThread, type ReplyView } from "@/app/networks/[id]/posts/[postId]/reply-thread";

/**
 * The composer and the thread together, because the Reply control on a
 * reply has to reach the composer's state.
 *
 * The composer sits directly under the post and above the replies, indented
 * with them. At the bottom of the list it drifts further down the page with
 * every reply added, until on a busy post the way to take part is off
 * screen entirely - and the indentation is what says "this is a reply to
 * that post" rather than a new post.
 */
export function ReplySection({
  networkId,
  postId,
  replies,
  someoneLabel,
  isEmbedded,
  canReply,
  signInHref,
  bodyLabel,
  bodyPlaceholder,
  submitLabel,
  isSignedLanguage,
  error,
  initialReplyTo,
  expandReplies,
}: {
  networkId: string;
  postId: string;
  replies: ReplyView[];
  someoneLabel: string;
  isEmbedded: boolean;
  canReply: boolean;
  signInHref: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  submitLabel: string;
  isSignedLanguage: boolean;
  error?: string;
  /**
   * Pre-selected target, carried in ?replyTo= when someone pressed Reply on
   * a reply out in the network feed. Without it, arriving here would
   * silently drop the thing they had just chosen to do.
   */
  initialReplyTo?: { id: string; name: string; replyId?: number } | null;
  /** Arrived from "View all N replies", so open the thread on landing. */
  expandReplies?: boolean;
}) {
  const t = useTranslations("postDetail");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; replyId?: number } | null>(
    initialReplyTo ?? null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the target once the reply actually sends. React resets the form
  // after a successful server action (and only then), which is the same
  // signal PostComposer uses to empty the textarea. Without this the chip
  // stays put and the NEXT reply silently goes to the same person.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onReset = () => setReplyTo(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [canReply]);

  return (
    <>
      {canReply ? (
        <form ref={formRef} action={createReply} className="flex flex-col gap-2 border-b border-border pb-6 pl-8">
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="networkId" value={networkId} />
          {isEmbedded && <input type="hidden" name="embed" value="1" />}
          {replyTo && <input type="hidden" name="replyToUserId" value={replyTo.id} />}
          {replyTo?.replyId != null && (
            <input type="hidden" name="replyToReplyId" value={replyTo.replyId} />
          )}
          {error && <FormError>{error}</FormError>}

          {replyTo && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <span>{t("replyingTo", { name: replyTo.name })}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t("clearReplyTarget")}
                className="hover:text-error"
              >
                ✕
              </button>
            </p>
          )}

          <PostComposer
            idPrefix="reply"
            bodyLabel={bodyLabel}
            bodyPlaceholder={bodyPlaceholder}
            submitLabel={submitLabel}
            isSignedLanguage={isSignedLanguage}
          />
          <PostingIndicator />
        </form>
      ) : (
        <div className="pl-8">
          <Link href={signInHref} className="text-sm text-primary underline">
            {t("signInToReply")}
          </Link>
        </div>
      )}

      <div className="pl-8">
        <ReplyThread
          replies={replies}
          someoneLabel={someoneLabel}
          onReply={setReplyTo}
          defaultExpanded={expandReplies}
        />
      </div>
    </>
  );
}
