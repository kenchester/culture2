"use client";

import { useRef, useState } from "react";
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

type Status = "idle" | "recording" | "preview" | "uploading" | "uploaded" | "error";

// Records up to 60s of audio or video directly in the browser and uploads
// it straight to the private post-media bucket (00000000000065), the same
// direct-to-storage-then-persist-just-the-path pattern
// app/profile/[id]/avatar-upload.tsx already uses. Deliberately renders
// its own hidden inputs (mediaType/mediaPath/mediaDurationSeconds) rather
// than calling a server action itself - it's meant to sit inside the
// surrounding <form action={createPost|createReply}>, so those values ride
// along with the normal form submit like every other field already does.
export function RecordMedia({
  kind,
  onReadyChange,
}: {
  kind: "audio" | "video";
  onReadyChange?: (ready: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setMediaPathAndNotify(path: string | null) {
    setMediaPath(path);
    onReadyChange?.(Boolean(path));
  }

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

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setDuration(Math.min(MAX_DURATION_SECONDS, Math.round((Date.now() - startTimeRef.current) / 1000)));
      setPreviewUrl(URL.createObjectURL(blob));
      setStatus("preview");
    };

    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();
    recorder.start();
    setStatus("recording");
    timeoutRef.current = setTimeout(() => stopRecording(), MAX_DURATION_SECONDS * 1000);
  }

  function stopRecording() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    mediaRecorderRef.current?.stop();
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMediaPathAndNotify(null);
    setDuration(0);
    setErrorMessage(null);
    setStatus("idle");
  }

  async function uploadRecording() {
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
    setMediaPathAndNotify(path);
    setStatus("uploaded");
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <input type="hidden" name="mediaType" value={mediaPath ? kind : ""} />
      <input type="hidden" name="mediaPath" value={mediaPath ?? ""} />
      <input type="hidden" name="mediaDurationSeconds" value={mediaPath ? duration : ""} />

      {status === "idle" && (
        <Button type="button" variant="secondary" onClick={startRecording} className="self-start">
          {kind === "video" ? "Record video (up to 60s)" : "Record audio (up to 60s)"}
        </Button>
      )}

      {status === "recording" && (
        <div className="flex items-center gap-2 text-sm text-error">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
          Recording...
          <button type="button" onClick={stopRecording} className="font-medium underline">
            Stop
          </button>
        </div>
      )}

      {previewUrl && (status === "preview" || status === "uploading" || status === "uploaded") && (
        <div className="flex flex-col gap-2">
          {kind === "video" ? (
            <video src={previewUrl} controls playsInline className="max-h-64 w-full rounded-md" />
          ) : (
            <audio src={previewUrl} controls className="w-full" />
          )}
          <div className="flex items-center gap-3">
            {status === "preview" && (
              <Button type="button" onClick={uploadRecording} className="px-3 py-1.5 text-xs">
                Use this recording
              </Button>
            )}
            {status === "uploading" && <span className="text-sm text-muted">Uploading...</span>}
            {status === "uploaded" && <span className="text-sm text-success">Ready to post</span>}
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
