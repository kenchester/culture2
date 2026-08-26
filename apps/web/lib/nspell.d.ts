// @types/nspell types its Dictionary.aff/dic as `string | Buffer`, but the
// dictionary-en/es/fr packages we actually use type theirs as `Uint8Array`
// (for cross-platform/browser compatibility) - at runtime in Node these
// are real Buffer instances (Buffer extends Uint8Array; node:fs/promises
// always returns Buffer), so the mismatch is type-only. A minimal local
// declaration matching our actual usage (lib/language-purity-check.ts)
// avoids depending on the stricter, incompatible upstream types package.
declare module "nspell" {
  type Dictionary = { aff: Uint8Array; dic: Uint8Array };

  class NSpell {
    constructor(dictionary: Dictionary);
    correct(word: string): boolean;
  }

  export default function nspell(dictionary: Dictionary): NSpell;
}
