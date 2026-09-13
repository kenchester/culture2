"use client";

import { useEffect, useRef, useState } from "react";
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
  // The textarea is deliberately UNCONTROLLED. When it held its value in
  // React state, a successful post left the text sitting in the box: the
  // server action revalidates and the feed re-renders, but this client
  // component is never unmounted, so its state survived and the post you
  // just made was still there to send again. React clears an uncontrolled
  // field itself after a server action succeeds.
  //
  // Only the emptiness is tracked here, to disable the button - and it has
  // to be resynced on reset, or the button stays enabled over a box React
  // has just emptied.
  const [hasBody, setHasBody] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Bumped on reset to remount RecordMedia, which otherwise keeps the
  // just-posted recording in its own state for the same reason.
  const [generation, setGeneration] = useState(0);

  // Owned here rather than inside either child: the checkbox lives among
  // RecordMedia's pre-record options, but the panel it opens renders above
  // RecordMedia, so neither component can hold the state on its own.
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const form = bodyRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setHasBody(false);
      setGeneration((n) => n + 1);
    };
    // React only resets on success; a failed action redirects instead, so
    // a rejected post keeps its text for the author to fix.
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [mode]);

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
              ref={bodyRef}
              placeholder={bodyPlaceholder}
              onChange={(e) => setHasBody(e.target.value.trim().length > 0)}
            />
          </Field>
          <SubmitButton disabled={!hasBody} className="self-start">
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
            key={`${mode}-${generation}`}
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
