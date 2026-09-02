"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DemoEntry } from "@/app/networks/demo-entry";
import { DemoComposer, type EphemeralItem } from "@/app/networks/demo-composer";


export type RealDemoReply = {
  id: number;
  body: string;
  media: { type: "audio" | "video"; url: string } | null;
  createdAt: string;
  authorName: string;
  authorHref: string;
  avatarUrl: string | null;
};

type EphemeralReply = EphemeralItem & { localId: string; createdAt: string };

// The Acme demo's stand-in for the real "sign in to reply"/<form
// action={createReply}> block (app/networks/[id]/posts/[postId]/page.tsx) -
// same pairing as DemoNetworkFeed on the main network page: real replies
// render through DemoEntry (translate stays real/unauthenticated, like and
// report are simulated), and a visitor's own replies exist only in this
// component's state, appended after the real ones since they were "just
// posted" and replies already render oldest-first, newest at the bottom.
export function DemoReplyThread({
  networkId,
  realReplies,
}: {
  networkId: number;
  realReplies: RealDemoReply[];
}) {
  const t = useTranslations("postDetail");
  const tDemo = useTranslations("demoNetwork");
  const [ephemeralReplies, setEphemeralReplies] = useState<EphemeralReply[]>([]);

  function addEphemeralReply(item: EphemeralItem) {
    setEphemeralReplies((prev) => [
      ...prev,
      { ...item, localId: crypto.randomUUID(), createdAt: new Date().toISOString() },
    ]);
  }

  function removeEphemeralReply(localId: string) {
    setEphemeralReplies((prev) => prev.filter((r) => r.localId !== localId));
  }

  return (
    <>
      <div className="flex flex-col gap-4 pl-8">
        {realReplies.map((reply) => (
          <div key={reply.id} className="flex gap-3">
            {reply.avatarUrl ? (
              <Image
                src={reply.avatarUrl}
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
                href={reply.authorHref}
                className="text-sm font-medium text-ink underline hover:text-primary"
              >
                {reply.authorName}
              </Link>
              <DemoEntry
                kind="reply"
                itemId={reply.id}
                body={reply.body}
                media={reply.media}
                createdAt={reply.createdAt}
                isEphemeral={false}
              />
            </div>
          </div>
        ))}

        {ephemeralReplies.map((reply) => (
          <div key={reply.localId} className="flex gap-3">
            <div className="h-6 w-6 shrink-0 rounded-full bg-border" />
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-ink">{tDemo("you")}</span>
              <DemoEntry
                kind="reply"
                itemId={null}
                body={reply.body}
                media={reply.media}
                createdAt={reply.createdAt}
                isEphemeral
                onRemove={() => removeEphemeralReply(reply.localId)}
              />
            </div>
          </div>
        ))}

        {realReplies.length === 0 && ephemeralReplies.length === 0 && (
          <p className="text-sm text-muted">{t("noRepliesYet")}</p>
        )}
      </div>

      <div className="border-t border-border pt-6">
        <DemoComposer
          idPrefix="demo-reply"
          bodyLabel={t("replyLabel")}
          bodyPlaceholder={t("replyPlaceholder")}
          submitLabel={t("replySubmit")}
          networkId={networkId}
          onPost={addEphemeralReply}
        />
      </div>
    </>
  );
}
