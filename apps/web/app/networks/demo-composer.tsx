"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { checkPostLanguagePurity } from "@/app/networks/actions";
import { RecordMedia } from "@/app/networks/[id]/record-media";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/form-error";

type Mode = "text" | "audio" | "video";

const MODES: { value: Mode; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

export type EphemeralItem = {
  body: string;
  media: { type: "audio" | "video"; url: string; durationSeconds: number } | null;
};

// The Acme demo's stand-in for PostComposer - same mode toggle and visual
// shape, but nothing here is wrapped in a <form action={server action}>.
// Text still runs through the real language-purity check
// (checkPostLanguagePurity, a read-only sibling of the one createPost
// already runs) so a visitor sees the same off-language rejection a real
// member would, but nothing is ever inserted - onPost just hands the
// caller a plain object to prepend to its own local list. Audio/video
// reuses RecordMedia's real recording UI via its onEphemeralPost escape
// hatch, which skips RecordMedia's normal upload-and-submit path entirely.
export function DemoComposer({
  idPrefix,
  bodyLabel,
  bodyPlaceholder,
  submitLabel,
  networkId,
  onPost,
}: {
  idPrefix: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  submitLabel: string;
  networkId: number;
  onPost: (item: EphemeralItem) => void;
}) {
  const tDemo = useTranslations("demoNetwork");
  const [mode, setMode] = useState<Mode>("text");
  const [bodyValue, setBodyValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmitText() {
    const trimmed = bodyValue.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    setError(null);
    const result = await checkPostLanguagePurity(networkId, trimmed);
    setIsSubmitting(false);
    if (result.blocked) {
      setError(result.message ?? "Please keep your post in the target language.");
      return;
    }
    onPost({ body: trimmed, media: null });
    setBodyValue("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 text-sm">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMode(m.value);
              setError(null);
            }}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              mode === m.value ? "bg-primary-light font-medium text-primary" : "text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <>
          <Field>
            <Label htmlFor={`${idPrefix}-body`}>{bodyLabel}</Label>
            <Textarea
              id={`${idPrefix}-body`}
              name="body"
              placeholder={bodyPlaceholder}
              value={bodyValue}
              onChange={(e) => setBodyValue(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${idPrefix}-error` : undefined}
            />
          </Field>
          {/* The language-purity rejection is the one error in this flow a
              user is genuinely likely to hit, and it previously appeared
              with no announcement at all - a screen reader user would just
              find their post silently not posted. */}
          {error && <InlineError id={`${idPrefix}-error`}>{error}</InlineError>}
          <Button
            type="button"
            onClick={handleSubmitText}
            disabled={isSubmitting || bodyValue.trim().length === 0}
            className="self-start"
          >
            {isSubmitting ? tDemo("posting") : submitLabel}
          </Button>
        </>
      ) : (
        <RecordMedia
          key={mode}
          kind={mode}
          onEphemeralPost={(data) => onPost({ body: "", media: data })}
        />
      )}
    </div>
  );
}
