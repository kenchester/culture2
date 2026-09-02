"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DemoEntry } from "@/app/networks/demo-entry";
import { DemoComposer, type EphemeralItem } from "@/app/networks/demo-composer";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";

type View = "student" | "instructor";

export type RealDemoPost = {
  id: number;
  body: string;
  media: { type: "audio" | "video"; url: string } | null;
  videoUrl: string | null;
  createdAt: string;
  authorName: string;
  authorHref: string;
  avatarUrl: string | null;
  replyHref: string;
  replyCountLabel: string;
};

type EphemeralPost = EphemeralItem & { localId: string; createdAt: string };

// The entire interactive area of an Acme (is_example) network page, in
// place of the real join/leave button + real instructor-prompt form + real
// composer + posts map that every other network still renders unchanged
// (see the isExample branch in app/networks/[id]/page.tsx). Everything
// below is either plain client state or a read-only/unauthenticated real
// action (DemoEntry's Translate) - nothing here ever calls
// joinNetwork/leaveNetwork/setNetworkPrompt/createPost, so there is
// nothing to revert: a page refresh discards it all simply because none
// of it was ever written anywhere.
export function DemoNetworkFeed({
  networkId,
  realPrompt,
  realPosts,
}: {
  networkId: number;
  realPrompt: string | null;
  realPosts: RealDemoPost[];
}) {
  const t = useTranslations("network");
  const tDemo = useTranslations("demoNetwork");
  const tEntry = useTranslations("editableEntry");
  const [view, setView] = useState<View>("student");
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [ephemeralPosts, setEphemeralPosts] = useState<EphemeralPost[]>([]);

  const effectivePrompt = promptOverride ?? realPrompt;

  function openPromptEditor() {
    setPromptDraft(effectivePrompt ?? "");
    setIsEditingPrompt(true);
  }

  function savePrompt() {
    setPromptOverride(promptDraft.trim() || null);
    setIsEditingPrompt(false);
  }

  function addEphemeralPost(item: EphemeralItem) {
    setEphemeralPosts((prev) => [
      { ...item, localId: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  function removeEphemeralPost(localId: string) {
    setEphemeralPosts((prev) => prev.filter((p) => p.localId !== localId));
  }

  return (
    <>
      {(effectivePrompt || view === "instructor") && (
        <div className="flex flex-col gap-2 rounded-md border border-primary bg-primary-light p-3">
          {isEditingPrompt ? (
            <div className="flex flex-col gap-2">
              <Field>
                <Label htmlFor="demo-prompt">{t("weeklyPromptEditLabel")}</Label>
                <Textarea
                  id="demo-prompt"
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  placeholder={t("weeklyPromptPlaceholder")}
                  rows={2}
                  autoFocus
                />
              </Field>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={savePrompt} className="self-start">
                  {t("weeklyPromptSave")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditingPrompt(false)}
                  className="self-start"
                >
                  {tEntry("cancel")}
                </Button>
              </div>
            </div>
          ) : effectivePrompt ? (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("weeklyPrompt")}
                </p>
                <p className="text-sm text-body">{effectivePrompt}</p>
              </div>
              {view === "instructor" && (
                <button
                  type="button"
                  onClick={openPromptEditor}
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  {tDemo("editPromptLink")}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openPromptEditor}
              className="self-start text-sm font-medium text-primary hover:underline"
            >
              {tDemo("setPromptLink")}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={() => setView("student")}
          className={view === "student" ? "" : "opacity-50"}
        >
          {tDemo("studentView")}
        </Button>
        <Button
          type="button"
          variant="success"
          onClick={() => setView("instructor")}
          className={view === "instructor" ? "" : "opacity-50"}
        >
          {tDemo("instructorView")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        {view === "student" && (
          <DemoComposer
            idPrefix="demo-post"
            bodyLabel={t("postLabel")}
            bodyPlaceholder={t("postPlaceholder")}
            submitLabel={t("postSubmit")}
            networkId={networkId}
            onPost={addEphemeralPost}
          />
        )}

        <div className="flex flex-col gap-4">
          {ephemeralPosts.map((post) => (
            <div key={post.localId} className="flex gap-3 border-b border-border pb-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-border" />
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-sm font-medium text-ink">{tDemo("you")}</span>
                <DemoEntry
                  kind="post"
                  itemId={null}
                  body={post.body}
                  media={post.media}
                  createdAt={post.createdAt}
                  isEphemeral
                  onRemove={() => removeEphemeralPost(post.localId)}
                />
              </div>
            </div>
          ))}

          {realPosts.map((post) => (
            <div key={post.id} className="flex gap-3 border-b border-border pb-4">
              {post.avatarUrl ? (
                <Image
                  src={post.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-border" />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <Link
                  href={post.authorHref}
                  className="text-sm font-medium text-ink underline hover:text-primary"
                >
                  {post.authorName}
                </Link>
                <DemoEntry
                  kind="post"
                  itemId={post.id}
                  body={post.body}
                  media={post.media}
                  createdAt={post.createdAt}
                  isEphemeral={false}
                />
                {post.videoUrl && (
                  <a
                    href={post.videoUrl}
                    className="text-sm text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {post.videoUrl}
                  </a>
                )}
                <Link href={post.replyHref} className="text-sm text-muted underline hover:text-primary">
                  {post.replyCountLabel}
                </Link>
              </div>
            </div>
          ))}

          {ephemeralPosts.length === 0 && realPosts.length === 0 && (
            <p className="text-sm text-muted">{t("noPostsYet")}</p>
          )}
        </div>
      </div>
    </>
  );
}
