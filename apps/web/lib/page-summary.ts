import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// Checked against Groq's live /v1/models list, not assumed - see
// lib/describe-yourself.ts for why that check matters (their previous
// small-tier model, llama-3.1-8b-instant, had already been retired).
// Writing is a slightly heavier task than that function's pure
// extraction, but still well within a small model's range: the facts are
// all supplied, nothing has to be looked up or reasoned about, only
// restated in one paragraph.
const MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You write one short paragraph (3-5 sentences) that ties together the facts given to you about a place or a language, for a reference page on a diaspora-community site.

Rules:
- Use ONLY the facts provided. Never add a number, a name, or a claim that is not in the input.
- Format every number with thousands separators (75,037, not 75037).
- Plain, factual prose - no bullet points, no headings, no markdown.
- Do not cite sources by name or add a "Source:" line - the page already cites everything separately, underneath this paragraph.
- Do not address the reader directly ("you") and do not use superlatives not justified by the numbers ("incredible", "amazing").
- If a field is null or missing, simply omit it - do not mention that data is "unavailable" or "not provided".
- Output the paragraph text only, nothing else - no quotation marks, no preamble.`;

function hashInputs(inputs: unknown): string {
  return createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
}

type Subject =
  | { placeA: number; placeB?: null; languageId?: null }
  | { placeA: number; placeB: number; languageId?: null }
  | { placeA?: null; placeB?: null; languageId: number };

/**
 * The one paragraph that reads a page's disjoint sections as a whole.
 *
 * Cache-first: a matching input_hash returns instantly with no model
 * call (page_summaries, 00000000000107). On a cache miss or a genuine
 * data change, this calls Groq once, caches the result for every future
 * visitor, and returns it. On any failure - Groq down, a bad response -
 * this falls back to whatever was cached last, even if stale, rather
 * than showing nothing; a page that worked a week ago is better than a
 * page that silently drops a paragraph the moment an API has a bad day.
 * Returns null only when nothing has ever been generated AND the live
 * call also failed - the caller's job on null is to simply not render
 * the section, the same as city_sister_cities being empty.
 */
export async function getPageSummary(subject: Subject, inputs: Record<string, unknown>): Promise<string | null> {
  const admin = createAdminClient();
  const currentHash = hashInputs(inputs);

  const query = admin.from("page_summaries").select("id, summary_text, input_hash");
  const scoped = subject.languageId
    ? query.eq("language_id", subject.languageId)
    : subject.placeB
      ? query.eq("place_a", subject.placeA).eq("place_b", subject.placeB)
      : query.eq("place_a", subject.placeA!).is("place_b", null);
  const { data: cached } = await scoped.maybeSingle();

  if (cached && cached.input_hash === currentHash) {
    return cached.summary_text;
  }

  const generated = await generate(inputs);
  if (!generated) {
    // Stale is still useful - better a paragraph about last month's
    // figures than no paragraph while this quarter's census load is
    // being rolled out.
    return cached?.summary_text ?? null;
  }

  const row = {
    place_a: subject.placeA ?? null,
    place_b: subject.placeB ?? null,
    language_id: subject.languageId ?? null,
    input_hash: currentHash,
    summary_text: generated,
    model: MODEL,
    generated_at: new Date().toISOString(),
  };
  // Select-then-write, not .upsert(): page_summaries_subject_idx
  // (00000000000107) is an expression index (coalesce(place_a, -1), ...),
  // needed because place_b/language_id are nullable - and ON CONFLICT
  // can only target a literal column list or a named constraint, never
  // an expression index. This exact mistake already happened twice this
  // session (corridor_answers, then stat_reactions) before being caught
  // here on the third attempt; fixed the same way each time.
  if (cached) {
    await admin.from("page_summaries").update(row).eq("id", cached.id);
  } else {
    await admin.from("page_summaries").insert(row);
  }

  return generated;
}

async function generate(inputs: Record<string, unknown>): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(inputs) },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[page-summary] fetch failed", e);
    return null;
  }
  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[page-summary] groq returned", response.status, await response.text());
    }
    return null;
  }

  try {
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[page-summary] bad response body", e);
    return null;
  }
}
