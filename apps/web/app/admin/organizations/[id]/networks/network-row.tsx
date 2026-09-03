"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Label } from "@/components/ui/input";

// One network per row: rename inline, or delete behind a typed
// confirmation. The two-step delete reveal mirrors DeleteOrgForm in
// organization-manager.tsx - a destructive control shouldn't sit one
// stray click away, and requiring the exact title makes it hard to
// delete the wrong row from a list where every row looks alike.
export function NetworkRow({
  organizationId,
  network,
  languageName,
  networkHref,
  renameOrgNetwork,
  deleteOrgNetwork,
}: {
  organizationId: number;
  network: { id: number; title: string; member_count: number; post_count: number };
  languageName: string;
  networkHref: string;
  renameOrgNetwork: (formData: FormData) => void;
  deleteOrgNetwork: (formData: FormData) => void;
}) {
  const [title, setTitle] = useState(network.title);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <a
          href={networkHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary hover:underline"
        >
          {network.title}
        </a>
        <p className="text-sm text-muted">
          {languageName} · {network.member_count} members, {network.post_count} posts
        </p>
      </div>

      <form action={renameOrgNetwork} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="networkId" value={network.id} />
        <input type="hidden" name="organizationId" value={organizationId} />
        <Field>
          <Label htmlFor={`title-${network.id}`}>Title</Label>
          <Input
            id={`title-${network.id}`}
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-80 max-w-full"
            required
          />
        </Field>
        <SubmitButton variant="secondary" pendingLabel="Saving…" disabled={title === network.title}>
          Rename
        </SubmitButton>
      </form>

      {!confirming ? (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          Delete network
        </Button>
      ) : (
        <form action={deleteOrgNetwork} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="networkId" value={network.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <Field>
            <Label htmlFor={`confirm-${network.id}`}>
              Type &quot;{network.title}&quot; to permanently delete this network and its{" "}
              {network.post_count} {network.post_count === 1 ? "post" : "posts"}
            </Label>
            <Input
              id={`confirm-${network.id}`}
              name="confirmTitle"
              placeholder={network.title}
              className="w-80 max-w-full"
              required
            />
          </Field>
          <SubmitButton variant="ghost" pendingLabel="Deleting…">
            Confirm delete
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
