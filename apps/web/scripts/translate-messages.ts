// Generates messages/{locale}.json for every supported locale other than
// English by translating messages/en.json (the source of truth) through
// Azure Translator. Safe to re-run: by default it only translates keys
// that don't already exist in a given locale's file, so hand-corrections
// survive. Pass --force to retranslate everything.
//
// Run via: npm run translate-messages [-- --force]
//
// Deliberately does NOT import lib/env.ts or lib/azure-translator.ts -
// both pull in the "server-only" package, which throws unconditionally
// when resolved outside a webpack server bundle (i.e. in this plain
// Node/tsx script).

import fs from "node:fs";
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
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key || !endpoint || !region) {
    throw new Error(
      "Missing AZURE_TRANSLATOR_KEY / AZURE_TRANSLATOR_ENDPOINT / AZURE_TRANSLATOR_REGION in environment",
    );
  }

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
    throw new Error(`Azure Translator request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as Array<{ translations: Array<{ text: string }> }>;
  return json.map((item, i) => restorePlaceholders(item.translations[0].text, protectedTexts[i].placeholders));
}

function readMessages(locale: string): MessageTree {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
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
