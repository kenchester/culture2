"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePost, updatePost } from "@/app/networks/actions";
import { deleteReply, updateReply } from "@/app/networks/[id]/posts/[postId]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Linkify } from "@/lib/linkify";

// Shared by both posts and replies (the two "kind"s of editable message in
// a network), since the edit/delete UI is identical - only which server
// action to call differs. redirectAfterDelete is for the one case where
// deleting the item means the page it's on no longer exists (a post's own
// detail page): navigate away instead of refreshing the now-404 page.
export function EditableEntry({
  kind,
  itemId,
  body,
  canModify,
  redirectAfterDelete,
}: {
  kind: "post" | "reply";
  itemId: number;
  body: string;
  canModify: boolean;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [draft, setDraft] = useState(body);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsPending(true);
    setError(null);
    const result = kind === "post" ? await updatePost(itemId, draft) : await updateReply(itemId, draft);
    setIsPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMode("view");
    router.refresh();
  }

  async function handleDelete() {
    setIsPending(true);
    setError(null);
    const result = kind === "post" ? await deletePost(itemId) : await deleteReply(itemId);
    setIsPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (redirectAfterDelete) {
      router.push(redirectAfterDelete);
    } else {
      router.refresh();
    }
  }

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || !draft.trim()}
            className="self-start px-3 py-1.5 text-xs"
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(body);
              setMode("view");
              setError(null);
            }}
            disabled={isPending}
            className="self-start px-3 py-1.5 text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body">
          <Linkify text={body} />
        </p>
        {canModify && mode === "view" && (
          <div className="flex shrink-0 gap-2 text-sm text-muted">
            <button
              type="button"
              onClick={() => setMode("edit")}
              aria-label={`Edit ${kind}`}
              className="hover:text-primary"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => setMode("confirmDelete")}
              aria-label={`Delete ${kind}`}
              className="hover:text-error"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {mode === "confirmDelete" && (
        <div className="flex items-center gap-2 text-sm text-body">
          <span>Delete this {kind}?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="font-medium text-error underline"
          >
            {isPending ? "Deleting…" : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={isPending}
            className="text-muted underline"
          >
            No
          </button>
        </div>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
