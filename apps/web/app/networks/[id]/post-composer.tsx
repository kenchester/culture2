"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RecordMedia } from "@/app/networks/[id]/record-media";
import { Field, Label, Textarea } from "@/components/ui/input";
import { SignedSummaryFields } from "@/app/networks/[id]/signed-summary-fields";
import { SubmitButton } from "@/components/ui/submit-button";

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
  isSignedLanguage = false,
}: {
  idPrefix: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  submitLabel: string;
  /** networks.language -> languages.is_signed. Hides Audio and offers a summary. */
  isSignedLanguage?: boolean;
}) {
  const t = useTranslations("editableEntry");
  const [mode, setMode] = useState<Mode>("text");
  const [bodyValue, setBodyValue] = useState("");
  // Owned here rather than inside either child: the checkbox lives among
  // RecordMedia's pre-record options, but the panel it opens renders above
  // RecordMedia, so neither component can hold the state on its own.
  const [showSummary, setShowSummary] = useState(false);

  // A signed language has no spoken form, so an audio post in one of these
  // networks is either a mistake or off-language - hiding the tab is
  // clearer than letting someone record into a void. Matches the
  // educators page's own framing that for ASL, video "isn't an add-on
  // here, it's the only way a student can post".
  const modes = isSignedLanguage ? MODES.filter((m) => m.value !== "audio") : MODES;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 text-sm">
        {modes.map((m) => (
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
        <>
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
          <SubmitButton disabled={bodyValue.trim().length === 0} className="self-start">
            {submitLabel}
          </SubmitButton>
        </>
      ) : (
        // RecordMedia's own "Post this recording" button submits the form
        // itself once the upload finishes - no separate submit button here,
        // there'd be two "Post" controls on screen otherwise.
        <>
          {/* Above RecordMedia so the summary is already filled in by the
              time the recording's own Post button submits the form. */}
          {isSignedLanguage && mode === "video" && showSummary && (
            <SignedSummaryFields idPrefix={idPrefix} />
          )}
          <RecordMedia
            key={mode}
            kind={mode}
            extraControls={
              isSignedLanguage && mode === "video" ? (
                <label className="flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    checked={showSummary}
                    onChange={(e) => setShowSummary(e.target.checked)}
                  />
                  {t("addSummary")}
                </label>
              ) : undefined
            }
          />
        </>
      )}
    </div>
  );
}
