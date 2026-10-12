/**
 * The rules for a public username, in one place.
 *
 * Used by registration and by the profile editor, which previously had no
 * validation at all: any string was accepted, a collision surfaced the raw
 * Postgres unique-violation text to the user, and because the old unique
 * constraint was case-sensitive, "Ken" and "ken" could both exist. In a
 * product where the whole point is that small communities recognise each
 * other, two accounts a case-flip apart is an impersonation tool.
 *
 * 00000000000090 enforces all of this in the database too. That is the
 * real guard; this exists to produce a message a person can act on.
 */

// Names that would let an account pass for CultureMesh itself or for an
// office the platform grants. Kept in sync by hand with the same list in
// 00000000000090 - if they ever drift, the database is stricter and the
// user sees the generic rejection, which is the safe direction.
const RESERVED = new Set([
  "admin",
  "administrator",
  "api",
  "consul",
  "culturemesh",
  "help",
  "learn",
  "mod",
  "moderator",
  "official",
  "root",
  "security",
  "staff",
  "support",
  "system",
  "team",
  "www",
]);

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// Must start alphanumeric so a username can't open with a character that
// reads as punctuation or disappears in a list.
const SHAPE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export type UsernameProblem = "tooShort" | "tooLong" | "shape" | "reserved";

/**
 * Returns null when the username is acceptable, or a problem code the
 * caller turns into a translated message.
 */
export function checkUsername(raw: string): UsernameProblem | null {
  const value = raw.trim();
  if (value.length < USERNAME_MIN) return "tooShort";
  if (value.length > USERNAME_MAX) return "tooLong";
  if (!SHAPE.test(value)) return "shape";
  if (RESERVED.has(value.toLowerCase())) return "reserved";
  return null;
}

/** Trimmed, or null when blank - matching how the columns store "unset". */
export function normalizeUsername(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  return value === "" ? null : value;
}

/**
 * True when a Postgres error from writing a profile is a username
 * collision, under either the original case-sensitive unique constraint or
 * the case-insensitive index added in 00000000000090.
 */
export function isUsernameTaken(message: string): boolean {
  return (
    message.includes("profiles_username_key") ||
    message.includes("profiles_username_lower_idx")
  );
}
