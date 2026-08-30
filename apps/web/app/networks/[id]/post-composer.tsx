"use client";

import { useState } from "react";
import { RecordMedia } from "@/app/networks/[id]/record-media";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";

type Mode = "text" | "audio" | "video";

const MODES: { value: Mode; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

// Owns the body-input-through-submit-button portion of the existing
// create-post/create-reply forms (app/networks/[id]/page.tsx and
// app/networks/[id]/posts/[postId]/page.tsx) - everything else about
// those forms (the <form action={createPost|createReply}>, its hidden
// networkId/postId/embed fields, the error banner) stays in the server
// component unchanged; this just replaces the single <Field><Textarea>
// block with a mode toggle that swaps between the text box and a
// RecordMedia recorder, since a post/reply is now either one or the other.
export function PostComposer({
  idPrefix,
  bodyLabel,
  bodyPlaceholder,
  submitLabel,
}: {
  idPrefix: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  submitLabel: string;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [bodyValue, setBodyValue] = useState("");
  const [mediaReady, setMediaReady] = useState(false);

  const canSubmit = mode === "text" ? bodyValue.trim().length > 0 : mediaReady;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 text-sm">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              mode === m.value ? "bg-primary-light font-medium text-primary" : "text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <Field>
          <Label htmlFor={`${idPrefix}-body`}>{bodyLabel}</Label>
          <Textarea
            id={`${idPrefix}-body`}
            name="body"
            placeholder={bodyPlaceholder}
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
          />
        </Field>
      ) : (
        <RecordMedia key={mode} kind={mode} onReadyChange={setMediaReady} />
      )}

      <Button type="submit" disabled={!canSubmit} className="self-start">
        {submitLabel}
      </Button>
    </div>
  );
}
