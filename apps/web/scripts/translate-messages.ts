// Generates messages/{locale}.json for every supported locale other than
// English by translating messages/en.json (the source of truth) through
// Azure Translator. Safe to re-run: by default it only translates keys
// that don't already exist in a given locale's file, so hand-corrections
// survive. Pass --force to retranslate everything.
//
// Run via: npm run translate-messages [-- --force]
//
// Pass --check to test the Azure credentials/endpoint and exit without
// translating anything: npm run translate-messages -- --check
//
// Deliberately does NOT import lib/env.ts or lib/azure-translator.ts -
// both pull in the "server-only" package, which throws unconditionally
// when resolved outside a webpack server bundle (i.e. in this plain
// Node/tsx script).

import fs from "node:fs";
import { resolveTranslatorEndpoint } from "../lib/azure-endpoint";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. CI) - fall through to whatever's already
  // in the environment.
}

const SUPPORTED_LOCALES = ["en", "es", "fr", "ja", "de", "zh", "it", "ar", "ko", "ru", "pt"] as const;
const LOCALE_TO_AZURE_CODE: Partial<Record<string, string>> = { zh: "zh-Hans" };
const BATCH_SIZE = 100;
// The Azure Translator tier this project is on rate-limits bursts of
// requests fired back to back (observed 429s after ~4-5 rapid calls) - a
// short pause between each locale's request keeps a full run under that
// without needing real backoff/retry logic.
const DELAY_BETWEEN_LOCALES_MS = 15000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MESSAGES_DIR = path.resolve(process.cwd(), "messages");

type MessageTree = { [key: string]: string | MessageTree };

function flatten(tree: MessageTree, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[fullKey] = value;
    } else {
      flatten(value, fullKey, out);
    }
  }
  return out;
}

function unflatten(flat: Record<string, string>): MessageTree {
  const out: MessageTree = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof node[part] !== "object") {
        node[part] = {};
      }
      node = node[part] as MessageTree;
    }
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

// Azure sometimes "translates" the contents of an ICU-style {placeholder}
// when the name inside happens to be a real English word (observed:
// "{members} members, {posts} posts" came back with the placeholder names
// themselves translated, e.g. "{miembros}", silently breaking next-intl's
// interpolation since the app calls t() with the original English arg
// names). Angle-bracket tags like <b>...</b>/<link>...</link> survive
// intact (confirmed separately), so placeholders are protected the same
// way: swapped for empty numbered tags before translation, restored after.
function protectPlaceholders(text: string): { protected: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const withProtected = text.replace(/\{[^}]+\}/g, (match) => {
    const index = placeholders.length;
    placeholders.push(match);
    return `<ph${index}></ph${index}>`;
  });
  return { protected: withProtected, placeholders };
}

function restorePlaceholders(text: string, placeholders: string[]): string {
  return text.replace(/<ph(\d+)><\/ph\1>/g, (_match, indexStr: string) => {
    return placeholders[Number(indexStr)] ?? "";
  });
}

async function translateBatch(texts: string[], targetAzureCode: string): Promise<string[]> {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key || !region) {
    throw new Error(
      "Missing AZURE_TRANSLATOR_KEY / AZURE_TRANSLATOR_REGION in environment",
    );
  }
  // Same validation the app uses, so this script can't succeed against a
  // configuration the app would reject (or vice versa).
  const endpoint = resolveTranslatorEndpoint(process.env.AZURE_TRANSLATOR_ENDPOINT);

  const protectedTexts = texts.map(protectPlaceholders);

  const url = new URL("translate", endpoint);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("from", "en");
  url.searchParams.set("to", targetAzureCode);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(protectedTexts.map(({ protected: text }) => ({ Text: text }))),
  });

  if (!res.ok) {
    const body = await res.text();
    // 401 here is far more often a wrong endpoint than a wrong key - Azure
    // returns the identical 401001 for both - so say so rather than
    // sending whoever hits this off to rotate a working key.
    const hint =
      res.status === 401
        ? `\n\nA 401 from Azure Translator usually means the endpoint is wrong, not the key.` +
          `\nThis resource has a custom subdomain and only accepts its own endpoint:` +
          `\n  https://<resource-name>.cognitiveservices.azure.com/translator/text/v3.0/` +
          `\nCurrently using: ${endpoint}`
        : "";
    throw new Error(`Azure Translator request failed: ${res.status} ${body}${hint}`);
  }

  const json = (await res.json()) as Array<{ translations: Array<{ text: string }> }>;
  return json.map((item, i) => restorePlaceholders(item.translations[0].text, protectedTexts[i].placeholders));
}

// --check: diagnose the Azure configuration without translating anything.
//
// The whole point of this is the order of operations. Azure returns HTTP
// 401 for both "wrong endpoint for this resource" and "key is nonsense",
// and on the GLOBAL host those two responses are byte-identical - verified
// by sending the literal string "definitely-not-a-key" and diffing it
// against a known-good key's response. So a 401 observed against the wrong
// host tells you nothing, and the natural next move (rotate the key) is
// wasted work on a key that was fine.
//
// Trying the resource's own endpoint FIRST is what makes the result
// readable, because there the two failures finally diverge:
//
//   resource endpoint + valid key  -> 200
//   resource endpoint + bad key    -> 401, error.code 401  (generic)
//   global endpoint   + valid key  -> 401, error.code 401001
//   global endpoint   + bad key    -> 401, error.code 401001  (identical)
//
// Hence: 401001 means the endpoint, not the key - no matter which key
// produced it. Only a plain 401 from the resource endpoint implicates the
// key itself.
async function checkConfiguration(): Promise<boolean> {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;

  let endpoint: string;
  try {
    endpoint = resolveTranslatorEndpoint(process.env.AZURE_TRANSLATOR_ENDPOINT);
  } catch (error) {
    console.error(`FAIL  endpoint\n${(error as Error).message}`);
    return false;
  }

  console.log(`endpoint  ${endpoint}`);
  console.log(`region    ${region ?? "(unset)"}`);
  console.log(`key       ${key ? `set, ${key.length} chars` : "(unset)"}`);
  console.log();

  if (!key) {
    console.error("FAIL  AZURE_TRANSLATOR_KEY is not set.");
    return false;
  }

  const url = new URL("translate", endpoint);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", "es");
  console.log(`POST ${url}`);

  const headers: Record<string, string> = {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "application/json",
  };
  // Optional on a custom-subdomain endpoint (confirmed: 200 with and
  // without), required on the global one. Send it when we have it.
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify([{ Text: "ping" }]) });
  } catch (error) {
    console.error(`\nFAIL  could not reach the endpoint: ${(error as Error).message}`);
    return false;
  }

  const body = await res.text();

  if (res.ok) {
    const json = JSON.parse(body) as Array<{ translations: Array<{ text: string }> }>;
    console.log(`\nOK  HTTP 200 - "ping" -> "${json[0]?.translations[0]?.text}"`);
    console.log("Endpoint, key, and region are all working.");
    return true;
  }

  let azureCode: string | number | undefined;
  try {
    azureCode = (JSON.parse(body) as { error?: { code?: string | number } }).error?.code;
  } catch {
    // Non-JSON body; fall through and print it raw.
  }

  console.error(`\nFAIL  HTTP ${res.status}${azureCode ? ` (Azure error.code ${azureCode})` : ""}`);

  if (String(azureCode) === "401001") {
    console.error(
      "\nThis is an ENDPOINT problem, not a key problem.\n" +
        "401001 is what Azure returns when the host doesn't serve this resource - a valid\n" +
        "key and a fabricated one produce the same response, so don't rotate the key on\n" +
        "the strength of it. Point AZURE_TRANSLATOR_ENDPOINT at the resource's own host:\n" +
        "  https://<resource-name>.cognitiveservices.azure.com/translator/text/v3.0/",
    );
  } else if (res.status === 401) {
    console.error(
      "\nThe endpoint above is a resource-specific host, and it answered - so this one\n" +
        "really does look like the KEY (or the region header). Check both keys on the\n" +
        "resource's Keys and Endpoint page.",
    );
  } else {
    console.error(`\n${body}`);
  }
  return false;
}

function readMessages(locale: string): MessageTree {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  if (process.argv.includes("--check")) {
    const ok = await checkConfiguration();
    if (!ok) process.exit(1);
    return;
  }

  const force = process.argv.includes("--force");

  const flatEn = flatten(readMessages("en"));
  const allKeys = Object.keys(flatEn);
  if (allKeys.length === 0) {
    console.log("messages/en.json has no string keys yet - nothing to translate.");
    return;
  }

  const targetLocales = SUPPORTED_LOCALES.filter((locale) => locale !== "en");

  for (const locale of targetLocales) {
    const flatExisting = flatten(readMessages(locale));
    const keysToTranslate = force ? allKeys : allKeys.filter((key) => !(key in flatExisting));

    if (keysToTranslate.length === 0) {
      console.log(`${locale}: up to date (${allKeys.length} keys)`);
      continue;
    }

    await sleep(DELAY_BETWEEN_LOCALES_MS);

    const azureCode = LOCALE_TO_AZURE_CODE[locale] ?? locale;
    const merged = { ...flatExisting };

    for (let i = 0; i < keysToTranslate.length; i += BATCH_SIZE) {
      const batchKeys = keysToTranslate.slice(i, i + BATCH_SIZE);
      const batchTexts = batchKeys.map((key) => flatEn[key]);
      const translated = await translateBatch(batchTexts, azureCode);
      batchKeys.forEach((key, idx) => {
        merged[key] = translated[idx];
      });
    }

    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(unflatten(merged), null, 2)}\n`, "utf8");
    console.log(`${locale}: translated ${keysToTranslate.length} new key(s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
