"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_DURATION_SECONDS = 60;

// Ordered by preference within each kind - Safari (iOS and macOS) doesn't
// support webm in MediaRecorder at all, so mp4 has to come first or
// isTypeSupported rejects everything there.
const CANDIDATE_MIME_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm", "audio/mp4", "audio/webm"];

function pickMimeType(kind: "audio" | "video"): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_MIME_TYPES.filter((t) => t.startsWith(kind)).find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return mimeType.startsWith("video") ? "mp4" : "m4a";
  return "webm";
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Media Fragments URI (#t=1) hints the browser to show the frame at 1s as
// the poster instead of frame 0 - camera warm-up means the very first
// frame is often just black, which otherwise becomes the permanent
// thumbnail every video post shows before playback.
function withPosterFrameHint(url: string): string {
  return `${url}#t=1`;
}

type Status = "idle" | "recording" | "preview" | "uploading" | "error";

// Records up to 60s of audio or video directly in the browser and uploads
// it straight to the private post-media bucket (00000000000065), the same
// direct-to-storage-then-persist-just-the-path pattern
// app/profile/[id]/avatar-upload.tsx already uses. "Post this recording"
// both uploads AND submits the surrounding <form action={createPost|
// createReply}> in one step - the hidden media fields are set via refs
// (not React state/controlled inputs) immediately before calling
// form.requestSubmit(), so the values are guaranteed correct at the exact
// moment the browser reads the form, with no risk of a stale re-render.
export function RecordMedia({ kind }: { kind: "audio" | "video" }) {
  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaTypeInputRef = useRef<HTMLInputElement>(null);
  const mediaPathInputRef = useRef<HTMLInputElement>(null);
  const mediaDurationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    const mimeType = pickMimeType(kind);
    if (!mimeType) {
      setErrorMessage("Recording isn't supported in this browser.");
      setStatus("error");
      return;
    }
    mimeTypeRef.current = mimeType;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { audio: true, video: true } : { audio: true },
      );
    } catch {
      setErrorMessage("Couldn't access your microphone/camera - check permissions and try again.");
      setStatus("error");
      return;
    }

    if (kind === "video" && liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (tickRef.current) clearInterval(tickRef.current);
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setElapsedSeconds(Math.min(MAX_DURATION_SECONDS, Math.round((Date.now() - startTimeRef.current) / 1000)));
      setPreviewUrl(URL.createObjectURL(blob));
      setStatus("preview");
    };

    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();
    recorder.start();
    setStatus("recording");
    setElapsedSeconds(0);
    tickRef.current = setInterval(() => {
      setElapsedSeconds(Math.min(MAX_DURATION_SECONDS, Math.round((Date.now() - startTimeRef.current) / 1000)));
    }, 1000);
    timeoutRef.current = setTimeout(() => stopRecording(), MAX_DURATION_SECONDS * 1000);
  }

  function stopRecording() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    mediaRecorderRef.current?.stop();
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsedSeconds(0);
    setErrorMessage(null);
    setStatus("idle");
  }

  function clearStagedRecording() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsedSeconds(0);
    setStatus("idle");
    if (mediaTypeInputRef.current) mediaTypeInputRef.current.value = "";
    if (mediaPathInputRef.current) mediaPathInputRef.current.value = "";
    if (mediaDurationInputRef.current) mediaDurationInputRef.current.value = "";
  }

  async function postRecording() {
    if (!previewUrl) return;
    setStatus("uploading");
    setErrorMessage(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage("Sign in to record.");
      setStatus("error");
      return;
    }

    const blob = await fetch(previewUrl).then((r) => r.blob());
    const path = `${user.id}/${crypto.randomUUID()}.${extensionFor(mimeTypeRef.current)}`;
    const { error } = await supabase.storage
      .from("post-media")
      .upload(path, blob, { contentType: mimeTypeRef.current });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
      return;
    }

    // Set directly via refs (uncontrolled) rather than React state, so
    // these are the exact values already on the DOM the instant
    // requestSubmit() reads the form below - no waiting on a re-render.
    if (mediaTypeInputRef.current) mediaTypeInputRef.current.value = kind;
    if (mediaPathInputRef.current) mediaPathInputRef.current.value = path;
    if (mediaDurationInputRef.current) mediaDurationInputRef.current.value = String(elapsedSeconds);
    mediaPathInputRef.current?.form?.requestSubmit();

    // The recording is submitted - clear the staging area immediately so
    // it can't be re-posted by clicking again, rather than waiting for the
    // page to finish its round trip.
    clearStagedRecording();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <input ref={mediaTypeInputRef} type="hidden" name="mediaType" defaultValue="" />
      <input ref={mediaPathInputRef} type="hidden" name="mediaPath" defaultValue="" />
      <input ref={mediaDurationInputRef} type="hidden" name="mediaDurationSeconds" defaultValue="" />

      {status === "idle" && (
        <Button type="button" variant="secondary" onClick={startRecording} className="self-start">
          {kind === "video" ? "Record video (up to 60s)" : "Record audio (up to 60s)"}
        </Button>
      )}

      {status === "recording" && (
        <div className="flex flex-col gap-2">
          {kind === "video" && (
            // muted: required for autoplay, and avoids echoing the mic
            // back while it's simultaneously being recorded.
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="max-h-64 w-full rounded-md bg-ink"
            />
          )}
          <div className="flex items-center gap-2 text-sm text-error">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
            <span className="tabular-nums">
              {formatTime(elapsedSeconds)} / {formatTime(MAX_DURATION_SECONDS)}
            </span>
            <button type="button" onClick={stopRecording} className="font-medium underline">
              Stop
            </button>
          </div>
        </div>
      )}

      {previewUrl && (status === "preview" || status === "uploading") && (
        <div className="flex flex-col gap-2">
          {kind === "video" ? (
            <video
              src={withPosterFrameHint(previewUrl)}
              controls
              playsInline
              className="max-h-64 w-full rounded-md"
            />
          ) : (
            <audio src={previewUrl} controls className="w-full" />
          )}
          <div className="flex items-center gap-3">
            {status === "preview" && (
              <Button type="button" onClick={postRecording} className="px-3 py-1.5 text-xs">
                Post this recording
              </Button>
            )}
            {status === "uploading" && <span className="text-sm text-muted">Posting...</span>}
            {status !== "uploading" && (
              <button type="button" onClick={reRecord} className="text-sm text-muted underline hover:text-primary">
                Re-record
              </button>
            )}
          </div>
        </div>
      )}

      {errorMessage && <p className="text-sm text-error">{errorMessage}</p>}
    </div>
  );
}
