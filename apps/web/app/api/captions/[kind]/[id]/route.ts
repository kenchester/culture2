import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TranscriptionSegment } from "@/lib/transcription";

// WebVTT captions for a video post or reply (WCAG 1.2.2 Captions
// (Prerecorded), Level A - which a transcript alone does NOT satisfy,
// since captions have to be synchronized and available during playback).
//
// Generated from the stored transcript_segments on each request rather
// than written to storage as .vtt files: the segments are already
// persisted, the file would be a second copy to keep in sync, and it would
// need its own bucket, RLS policy and cleanup-on-delete path. Rendering a
// few hundred bytes of text is cheaper than any of that.
//
// Deliberately readable by anyone who can read the post itself - the
// select below runs through the normal per-request client, so RLS decides,
// exactly as it does for the post body.

function formatTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return (
    `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:` +
    `${String(ss).padStart(2, "0")}.${String(ms).padStart(3, "0")}`
  );
}

function toWebVtt(segments: TranscriptionSegment[]): string {
  const cues = segments
    .filter((s) => s.text?.trim())
    .map(
      (s, i) =>
        `${i + 1}\n${formatTimestamp(s.start)} --> ${formatTimestamp(s.end)}\n${s.text.trim()}`,
    );
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const table = kind === "reply" ? "post_replies" : kind === "post" ? "posts" : null;
  if (!table) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("transcript_segments")
    .eq("id", Number(id))
    .maybeSingle();

  const segments = (data?.transcript_segments as TranscriptionSegment[] | null) ?? [];
  if (segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(toWebVtt(segments), {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      // Transcripts are only written once, right after the post is
      // created, so these are effectively immutable in practice.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
