// Transcribes any audio/video post or reply that doesn't have a transcript
// yet - both the handful that predate the feature, and anything whose
// live transcription failed (a Groq 429 during a burst leaves transcript
// null by design, and this is how those get picked up).
//
// Safe to re-run: it only ever selects rows where transcript is null, and
// signed-language networks are skipped entirely since there is no speech
// in a signed video to transcribe.
//
// Run via: npx tsx scripts/backfill-transcripts.ts [--limit N]

import { createClient } from "@supabase/supabase-js";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";

const LANGUAGE_NAME_TO_ISO: Record<string, string> = {
  english: "en", spanish: "es", french: "fr", chinese: "zh", mandarin: "zh",
  arabic: "ar", portuguese: "pt", german: "de", italian: "it",
  japanese: "ja", korean: "ko", russian: "ru",
};

function normalizeLanguage(raw: string | undefined): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  return LANGUAGE_NAME_TO_ISO[lower] ?? lower;
}

async function main() {
  process.loadEnvFile(".env.local");
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey.startsWith("PLACEHOLDER")) {
    console.error("GROQ_API_KEY missing or still a placeholder in .env.local.");
    process.exit(1);
  }

  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 100;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Which networks are signed-language, so their video posts are skipped.
  const { data: signedLanguages } = await admin.from("languages").select("id").eq("is_signed", true);
  const signedIds = new Set((signedLanguages ?? []).map((l) => l.id));
  const { data: networks } = await admin.from("networks").select("id, language_id");
  const signedNetworkIds = new Set(
    (networks ?? []).filter((n) => n.language_id && signedIds.has(n.language_id)).map((n) => n.id),
  );

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const table of ["posts", "post_replies"] as const) {
    // post_replies reaches its network through its parent post.
    const select =
      table === "posts"
        ? "id, media_path, media_type, network_id"
        : "id, media_path, media_type, post:posts(network_id)";
    const { data: rows, error } = await admin
      .from(table)
      .select(select)
      .not("media_path", "is", null)
      .is("transcript", null)
      .limit(limit);

    if (error) {
      console.error(`${table}: ${error.message}`);
      continue;
    }

    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      const networkId =
        (row.network_id as number | undefined) ??
        (row.post as { network_id?: number } | null)?.network_id;
      if (networkId && signedNetworkIds.has(networkId)) {
        skipped += 1;
        continue;
      }

      const mediaPath = row.media_path as string;
      const { data: blob, error: dlError } = await admin.storage.from("post-media").download(mediaPath);
      if (dlError || !blob) {
        console.log(`  ${table}#${row.id}: download failed`);
        failed += 1;
        continue;
      }

      const form = new FormData();
      form.set("file", blob, mediaPath.split("/").pop() ?? "recording.webm");
      form.set("model", MODEL);
      form.set("response_format", "verbose_json");
      form.set("timestamp_granularities[]", "segment");

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      });

      if (!res.ok) {
        console.log(`  ${table}#${row.id}: groq ${res.status} ${await res.text()}`);
        failed += 1;
        // Back off on rate limiting rather than hammering through the rest.
        if (res.status === 429) await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const data = (await res.json()) as {
        text?: string;
        language?: string;
        segments?: Array<{ start?: number; end?: number; text?: string }>;
      };
      const text = (data.text ?? "").trim();
      if (!text) {
        console.log(`  ${table}#${row.id}: empty transcript (silence?)`);
        skipped += 1;
        continue;
      }

      const segments = (data.segments ?? [])
        .filter((sg) => typeof sg.start === "number" && typeof sg.end === "number" && sg.text)
        .map((sg) => ({ start: sg.start!, end: sg.end!, text: sg.text!.trim() }));

      await admin
        .from(table)
        .update({
          transcript: text,
          transcript_language: normalizeLanguage(data.language) || null,
          transcript_segments: segments.length > 0 ? segments : null,
        })
        .eq("id", row.id as number);

      console.log(`  ${table}#${row.id}: [${normalizeLanguage(data.language)}] ${text.slice(0, 70)}`);
      done += 1;
    }
  }

  console.log(`\ntranscribed ${done}, skipped ${skipped}, failed ${failed}`);
}

main();
