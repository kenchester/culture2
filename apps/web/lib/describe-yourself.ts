import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// A small, fast model is the right tool here: this is pure extraction
// ("what place or language did they mention"), not reasoning or writing,
// and it runs on every submission of a form a first-time, possibly
// skeptical visitor is using. Checked against Groq's live /v1/models list
// rather than assumed - their catalog turns over (llama-3.1-8b-instant,
// this function's first choice, had already been retired by the time
// this shipped) - openai/gpt-oss-20b is their current small/fast tier. If
// Groq retires this one too, re-check the list rather than guessing a
// name from memory; accuracy on this task does not need a larger model.
const MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You extract two things from a short piece of free text someone wrote about themselves, for a diaspora-network search form:

1. Their ORIGIN - a place they are from, or a language they speak/identify with. Prefer a language only when they name one explicitly ("I speak Cantonese", "a Hakka family") - otherwise treat it as a place (a country, region, or city).
2. Their LOCATION - where they live now, or where they want to connect with people.

Rules:
- Extract ONLY what is stated or unambiguously implied. Never invent a place or language that was not mentioned.
- Each query is a short name only (1-4 words) - a place or language name, never a full sentence or description.
- If either side is genuinely not mentioned, use null for both its fields - do not guess.
- Output STRICT JSON only, matching this exact shape, no other text:
{"originKind": "place" | "language" | null, "originQuery": string | null, "locationQuery": string | null}

Example input: "I just moved to Houston from Fuzhou, my family speaks Hokkien"
Example output: {"originKind": "place", "originQuery": "Fuzhou", "locationQuery": "Houston"}

Example input: "looking for other Cantonese speakers near Chicago"
Example output: {"originKind": "language", "originQuery": "Cantonese", "locationQuery": "Chicago"}`;

const ExtractionSchema = z.object({
  originKind: z.enum(["place", "language"]).nullable(),
  originQuery: z.string().trim().min(1).max(80).nullable(),
  locationQuery: z.string().trim().min(1).max(80).nullable(),
});

export type DescribedOrigin = z.infer<typeof ExtractionSchema>;

/**
 * Turns free text into the same two fields the ordinary search form
 * collects - never more.
 *
 * This is the entire reason an LLM is trustworthy here despite running on
 * arbitrary visitor-typed text: its output does nothing but prefill
 * originKind/originQuery/locationQuery on /search/results, which already
 * treats ANY string a visitor types into the ordinary search box as
 * untrusted input - it runs through guess_places/guess_languages (ILIKE
 * matching against real rows, top-3, read-only) exactly the same way
 * either way. A model that mishandles the prompt, or text designed to
 * confuse it, produces at worst a search query that matches nothing or
 * matches the wrong thing - not a different code path, and not elevated
 * access. Nothing this function returns is ever interpreted as an
 * instruction, rendered unescaped, or used anywhere but those two query
 * strings.
 *
 * Returns null on any failure (bad response, network error, doesn't
 * parse) rather than throwing - the caller's job on null is to fall back
 * to the plain search form, never to block someone from searching at all.
 */
export async function describeYourself(text: string): Promise<DescribedOrigin | null> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 500) return null;

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
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[describe-yourself] fetch failed", e);
    return null;
  }
  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[describe-yourself] groq returned", response.status, await response.text());
    }
    return null;
  }

  let content: string | undefined;
  try {
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    content = body.choices?.[0]?.message?.content;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[describe-yourself] bad response body", e);
    return null;
  }
  if (!content) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[describe-yourself] bad JSON from model", content, e);
    return null;
  }

  // The model is asked for exactly this shape, but asking is not the
  // same as getting it - validated rather than trusted, same as any
  // other external response.
  const parsed = ExtractionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[describe-yourself] schema mismatch", parsedJson, parsed.error.message);
    }
    return null;
  }

  // A language without a kind, or a kind without a query, is a
  // half-extraction this function will not pass on as if it were whole.
  if ((parsed.data.originKind === null) !== (parsed.data.originQuery === null)) return null;

  return parsed.data;
}
