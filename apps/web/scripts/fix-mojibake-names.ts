// Fixes a handful of place names that got double-encoded at some point
// before this database existed (UTF-8 bytes misread as Windows-1252 and
// re-saved) - e.g. "Ã…land" instead of "Åland". Reverses it by
// re-encoding the (incorrectly decoded) JS string back to its original
// byte sequence using Windows-1252 (Node has no built-in Windows-1252
// Buffer encoding, hence the small manual high-byte map - it only
// differs from Latin-1 in the 0x80-0x9F range), then decoding those
// bytes as UTF-8.
//
// Only touches rows containing the literal "Ã" character, since that's
// otherwise vanishingly unlikely to appear in a genuine place name -
// confirmed exactly 4 affected rows (all in `places`) via a full-table
// scan before writing this.
//
// Run via: npm run fix-mojibake-names

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. CI) - fall through to whatever's already
  // in the environment.
}

// Windows-1252's 0x80-0x9F range - the only place it diverges from
// Latin-1 (0xA0-0xFF are identical in both).
const CP1252_HIGH: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function fixMojibake(name: string): string | null {
  const bytes: number[] = [];
  for (const ch of name) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) {
      bytes.push(code);
    } else if (CP1252_HIGH[ch] !== undefined) {
      bytes.push(CP1252_HIGH[ch]);
    } else {
      return null; // Not representable - not the mojibake pattern we expect.
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: rows, error } = await admin.from("places").select("id, name").like("name", "%Ã%");
  if (error) throw error;

  for (const row of rows ?? []) {
    const fixed = fixMojibake(row.name);
    if (!fixed || fixed === row.name) {
      console.log(`skipped (no confident fix): "${row.name}"`);
      continue;
    }
    const { error: updateError } = await admin.from("places").update({ name: fixed }).eq("id", row.id);
    if (updateError) throw updateError;
    console.log(`"${row.name}" -> "${fixed}"`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
