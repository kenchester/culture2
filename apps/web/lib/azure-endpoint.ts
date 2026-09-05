// Deliberately free of "server-only" so scripts/translate-messages.ts can
// import it too - that script runs under plain node/tsx and cannot touch
// lib/env.ts or lib/azure-translator.ts for exactly that reason.

// The shared multi-service endpoint. Valid for Translator resources
// created WITHOUT a custom subdomain; rejected by ones that have one.
export const GLOBAL_TRANSLATOR_ENDPOINT = "api.cognitive.microsofttranslator.com";

/**
 * Validates and normalizes AZURE_TRANSLATOR_ENDPOINT, failing loudly and
 * specifically rather than letting a misconfiguration masquerade as an
 * auth problem.
 *
 * Two traps this exists to catch, both verified against the live API:
 *
 * 1. **The global endpoint returns 401001 for a valid key** when the
 *    resource has a custom subdomain. Measured: the real key and a
 *    fabricated all-zeros key produce byte-identical responses -
 *    HTTP 401, `error.code=401001`, "The request is not authorized
 *    because credentials are missing or invalid." Nothing in that
 *    response distinguishes a wrong URL from a wrong key, so anyone
 *    debugging it reasonably starts by rotating a key that was never the
 *    problem. Hence: reject the global endpoint outright, by name.
 *
 *    Worse, the Azure portal actively points you at the broken value. On
 *    this resource's "Keys and Endpoint" page, the **Text Translation**
 *    line reads "https://api.cognitive.microsofttranslator.com/" - the
 *    global host, which does not work here. The correct host appears only
 *    on the **Document Translation** line, and you have to append
 *    "/translator/text/v3.0/" to it yourself to get the text API. So the
 *    obvious copy-paste is the wrong one, and the error it produces
 *    accuses the key. Don't trust that line for a resource with a custom
 *    subdomain; confirm with `npm run translate-messages -- --check`.
 *
 * 2. **A missing trailing slash silently truncates the path.** The call
 *    sites build their URL with `new URL("translate", endpoint)`, and
 *    relative resolution drops the last segment when there's no trailing
 *    slash: ".../translator/text/v3.0" becomes
 *    ".../translator/text/translate", quietly losing the version. Fixed
 *    here rather than left to whoever pastes the value.
 */
export function resolveTranslatorEndpoint(raw: string | undefined | null): string {
  const value = raw?.trim();

  if (!value) {
    throw new Error(
      "AZURE_TRANSLATOR_ENDPOINT is not set.\n" +
        "Set it to this Translator resource's own endpoint, not the shared global one:\n" +
        "  https://<resource-name>.cognitiveservices.azure.com/translator/text/v3.0/\n" +
        "Find it in the Azure portal under the resource's Keys and Endpoint page.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `AZURE_TRANSLATOR_ENDPOINT is not a valid URL: ${JSON.stringify(value)}\n` +
        "Expected https://<resource-name>.cognitiveservices.azure.com/translator/text/v3.0/",
    );
  }

  if (url.hostname === GLOBAL_TRANSLATOR_ENDPOINT) {
    throw new Error(
      `AZURE_TRANSLATOR_ENDPOINT is set to the shared global endpoint (${GLOBAL_TRANSLATOR_ENDPOINT}).\n` +
        "This project's Translator resource has a custom subdomain, and the global endpoint rejects\n" +
        "its key with HTTP 401 / error 401001 (\"credentials are missing or invalid\") even though the\n" +
        "key is valid - the same response a completely fabricated key produces, which is why this is\n" +
        "worth failing on explicitly rather than discovering at runtime.\n" +
        "Use the resource's own endpoint instead:\n" +
        "  https://<resource-name>.cognitiveservices.azure.com/translator/text/v3.0/",
    );
  }

  // new URL("translate", base) drops the last path segment unless the base
  // ends in a slash - see the note above.
  return url.pathname.endsWith("/") ? url.toString() : `${url.toString()}/`;
}
