import "server-only";
import { env } from "@/lib/env";

type AzureTranslateResult = {
  text: string;
  detectedLanguage?: string;
};

/**
 * Translates a single piece of text via Azure Translator. Omitting `from`
 * lets Azure auto-detect the source language - used for post/reply
 * translation, since we don't track a per-post source language today.
 */
export async function translateText(
  text: string,
  targetAzureCode: string,
  from?: string,
): Promise<AzureTranslateResult> {
  const url = new URL("translate", env.AZURE_TRANSLATOR_ENDPOINT);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", targetAzureCode);
  if (from) {
    url.searchParams.set("from", from);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_TRANSLATOR_KEY,
      "Ocp-Apim-Subscription-Region": env.AZURE_TRANSLATOR_REGION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
  });

  if (!res.ok) {
    throw new Error(`Azure Translator request failed: ${res.status}`);
  }

  const [result] = (await res.json()) as Array<{
    translations: Array<{ text: string }>;
    detectedLanguage?: { language: string };
  }>;

  return {
    text: result.translations[0].text,
    detectedLanguage: result.detectedLanguage?.language,
  };
}
