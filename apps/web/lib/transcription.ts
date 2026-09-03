import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
// $0.04/hr, ~216x realtime. The non-turbo whisper-large-v3 is ~2.8x the
// price and only worth it if accuracy on accented L2 speech proves
// inadequate in practice - see the plan's note on why we don't block posts
// on that accuracy either way.
const MODEL = "whisper-large-v3-turbo";

// A short priming prompt, per language, biasing *how* Whisper writes what
// it hears - not what it hears. Only added where there's a demonstrated
// problem to solve.
//
// zh: without this, Whisper freely mixes Traditional characters into a
// Simplified-Chinese network (這個狗很可愛 where 这个狗很可爱 was meant)
// and will sometimes translate a whole segment into English mid-clip
// rather than transcribing it. A Simplified-Chinese prompt fixed both on
// a real 34-second learner recording: all Traditional characters became
// Simplified, and the segment Whisper had rendered as "Kennie Jishal,
// this is my good friend" came back as Chinese.
//
// Note this is a different mechanism from priming with vocabulary, which
// was tested separately and does NOT fix homophone/tone errors.
//
// Deliberately contains no Latin text, and must stay that way. Whisper
// decodes autoregressively, conditioning on what it has already emitted
// (and on this prompt), so English context actively biases it toward
// hearing subsequent Mandarin as English. Measured on a real recording
// where the speaker said their own English name immediately before
// 给你介绍: with this prompt Whisper produced "Kenny 介绍"; appending just
// "我叫Ken Chester。" to the prompt degraded it further to "Kenny Jishal";
// with no prompt at all the whole segment came out as English prose. So
// adding example names here to "help with proper nouns" would make things
// measurably worse, not better.
const LANGUAGE_PROMPTS: Record<string, string> = {
  zh: "以下是普通话内容，请使用简体中文转写。",
};

export type TranscriptionSegment = { start: number; end: number; text: string };

export type TranscriptionResult = {
  text: string;
  /** Whisper's auto-detected language, ISO-639-1. */
  language: string;
  segments: TranscriptionSegment[];
};

type GroqVerboseJson = {
  text?: string;
  language?: string;
  segments?: Array<{ start?: number; end?: number; text?: string }>;
};

// Whisper reports the language it detected using a mix of ISO-639-1 codes
// and full English names ("english", "spanish") depending on the path
// taken; normalize the common cases so downstream comparisons against a
// network's languages.iso_code actually match.
const LANGUAGE_NAME_TO_ISO: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  chinese: "zh",
  mandarin: "zh",
  arabic: "ar",
  portuguese: "pt",
  german: "de",
  italian: "it",
  japanese: "ja",
  korean: "ko",
  russian: "ru",
};

function normalizeLanguage(raw: string | undefined): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  return LANGUAGE_NAME_TO_ISO[lower] ?? lower;
}

/**
 * Transcribes a recorded audio/video blob via Groq's Whisper endpoint.
 *
 * Groq accepts webm and mp4 directly - the exact containers RecordMedia
 * produces (webm on Chrome/Firefox, mp4 on Safari) - so there is no
 * transcoding step. That format match is the whole reason this vendor was
 * picked over Azure, whose short-audio endpoint only takes wav/pcm or
 * ogg/opus and would have required ffmpeg infrastructure this stack
 * doesn't have.
 *
 * Sends the network's language as a hint when we know it. An earlier
 * version deliberately omitted it, to keep Whisper's detected language an
 * independent signal for a soft "this sounded like English" advisory.
 * Real learner speech killed that idea: two genuinely Mandarin videos from
 * a second-language speaker were both detected as "en" (the transcripts
 * were correctly in Chinese characters - only the language label was
 * wrong), so the advisory fired on 100% of real posts. Detection is not
 * trustworthy for exactly the accented L2 speech this product exists to
 * host, so the advisory is gone and the hint - which also cuts latency -
 * is passed instead.
 *
 * Returns null on any failure. Transcription is strictly best-effort:
 * `transcript` is nullable by design and a failed call must never turn a
 * successful post into an error for the person who made it.
 */
export async function transcribeMedia(
  blob: Blob,
  fileName: string,
  languageHint?: string | null,
): Promise<TranscriptionResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const form = new FormData();
      form.set("file", blob, fileName);
      form.set("model", MODEL);
      form.set("response_format", "verbose_json");
      form.set("timestamp_granularities[]", "segment");
      if (languageHint) {
        form.set("language", languageHint);
        const prompt = LANGUAGE_PROMPTS[languageHint];
        if (prompt) {
          form.set("prompt", prompt);
        }
      }

      const res = await fetch(GROQ_TRANSCRIPTION_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: form,
      });

      // 429 is the expected failure here, and it's far more likely to come
      // from the free tier's 20 requests/minute cap than from any daily
      // volume limit - usage is bursty (a class posts together when an
      // assignment is due, not spread evenly). One short backoff covers
      // the common case; anything worse gives up and leaves transcript
      // null, which the backfill script can pick up later.
      if (res.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as GroqVerboseJson;
      const text = (data.text ?? "").trim();
      if (!text) {
        return null;
      }

      return {
        text,
        language: normalizeLanguage(data.language),
        segments: (data.segments ?? [])
          .filter((s) => typeof s.start === "number" && typeof s.end === "number" && s.text)
          .map((s) => ({ start: s.start!, end: s.end!, text: s.text!.trim() })),
      };
    } catch {
      return null;
    }
  }
  return null;
}

// A network's target language, for both the is_signed gate and the soft
// language advisory. Read from networks.language_id rather than
// organization_languages, because transcription is site-wide (the
// accessibility requirement doesn't care whether a network is school-
// gated) while organization_languages only covers org-gated ones. A
// network anchored to a place rather than a language has a null
// language_id - that's fine, it just means no advisory.
export async function getNetworkLanguage(
  supabase: SupabaseClient,
  networkId: number,
): Promise<{ name: string; iso_code: string | null; is_signed: boolean } | null> {
  const { data: network } = await supabase
    .from("networks")
    .select("language:languages(name, iso_code, is_signed)")
    .eq("id", networkId)
    .maybeSingle();
  return (network?.language as unknown as
    | { name: string; iso_code: string | null; is_signed: boolean }
    | null) ?? null;
}

/**
 * Downloads a just-uploaded recording, transcribes it, and writes the
 * transcript back onto the row. Returns the detected language (for the
 * caller's soft advisory), or null if anything at all went wrong.
 *
 * Entirely best-effort: every failure path leaves `transcript` null, which
 * is a valid state the backfill script can pick up later. The post itself
 * is already inserted by the time this runs, so nothing here can cost
 * someone their post.
 */
export async function transcribeStoredMedia(
  supabase: SupabaseClient,
  table: "posts" | "post_replies",
  rowId: number,
  mediaPath: string,
  languageHint?: string | null,
): Promise<string | null> {
  try {
    const { data: blob, error } = await supabase.storage.from("post-media").download(mediaPath);
    if (error || !blob) {
      return null;
    }

    // Groq sniffs the container from the filename extension, and
    // media_path already carries the right one (webm on Chrome/Firefox,
    // mp4/m4a on Safari - see RecordMedia's extensionFor).
    const fileName = mediaPath.split("/").pop() ?? "recording.webm";
    const result = await transcribeMedia(blob, fileName, languageHint);
    if (!result) {
      return null;
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({
        transcript: result.text,
        // With a hint passed, Whisper's returned label is just an echo of
        // it, so prefer the code we actually know. Only fall back to
        // detection for networks with no language of their own (a
        // place-based network like "People from India in Michigan").
        transcript_language: languageHint || result.language || null,
        transcript_segments: result.segments.length > 0 ? result.segments : null,
      })
      .eq("id", rowId);

    // Any cached translation of this row's *previous* transcript is now
    // wrong, and post_translations is read before Azure is ever called - so
    // without this the stale text wins forever. Only reachable via the
    // admin client: DELETE here is granted to service_role, not to
    // authenticated (00000000000076), since this is a cache shared by
    // every viewer.
    if (!updateError) {
      try {
        const admin = createAdminClient();
        const column = table === "posts" ? "post_id" : "reply_id";
        await admin.from("post_translations").delete().eq(column, rowId).eq("field", "transcript");
      } catch {
        // Best-effort: a stale cache entry is a worse outcome than a
        // failed delete, but neither should cost the poster their post.
      }
    }

    return result.language || null;
  } catch {
    return null;
  }
}
