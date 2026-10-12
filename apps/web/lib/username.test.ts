import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkUsername,
  isUsernameTaken,
  normalizeUsername,
} from "./username";

test("accepts ordinary usernames", () => {
  for (const value of ["abc", "ken_chester", "a1.b-c", "Somali_Lansing", "x".repeat(30)]) {
    assert.equal(checkUsername(value), null, value);
  }
});

test("rejects usernames that are too short or too long", () => {
  assert.equal(checkUsername("ab"), "tooShort");
  assert.equal(checkUsername(""), "tooShort");
  assert.equal(checkUsername("x".repeat(31)), "tooLong");
});

test("rejects shapes that would read as formatting or disappear", () => {
  // Leading punctuation can vanish in a list or pass for markup.
  assert.equal(checkUsername("_leading"), "shape");
  assert.equal(checkUsername(".hidden"), "shape");
  assert.equal(checkUsername("-dash"), "shape");
  assert.equal(checkUsername("has space"), "shape");
  assert.equal(checkUsername("emoji🙂"), "shape");
  assert.equal(checkUsername("semi;colon"), "shape");
});

test("rejects names that would pass for the platform or an office", () => {
  assert.equal(checkUsername("admin"), "reserved");
  assert.equal(checkUsername("CultureMesh"), "reserved");
  // The office is granted by election; an account must not simply claim it.
  assert.equal(checkUsername("consul"), "reserved");
  assert.equal(checkUsername("SUPPORT"), "reserved");
});

test("reserved matching is case-insensitive but not substring-greedy", () => {
  assert.equal(checkUsername("Admin"), "reserved");
  // A real name that merely contains a reserved word is fine.
  assert.equal(checkUsername("administrator_fan"), null);
  assert.equal(checkUsername("consulate_history"), null);
});

test("leading and trailing space does not smuggle a short name through", () => {
  assert.equal(checkUsername("  ab  "), "tooShort");
  assert.equal(checkUsername("  abc  "), null);
});

test("normalize turns blank into null so the column means 'unset'", () => {
  assert.equal(normalizeUsername(""), null);
  assert.equal(normalizeUsername("   "), null);
  assert.equal(normalizeUsername(null), null);
  assert.equal(normalizeUsername(undefined), null);
  assert.equal(normalizeUsername("  ken  "), "ken");
});

test("recognises both unique constraints as 'taken'", () => {
  // The original case-sensitive constraint...
  assert.equal(
    isUsernameTaken('duplicate key value violates unique constraint "profiles_username_key"'),
    true,
  );
  // ...and the case-insensitive index from 00000000000090, which is what
  // catches "Ken" when "ken" exists.
  assert.equal(
    isUsernameTaken(
      'duplicate key value violates unique constraint "profiles_username_lower_idx"',
    ),
    true,
  );
  assert.equal(isUsernameTaken("violates check constraint profiles_username_shape"), false);
  assert.equal(isUsernameTaken("some unrelated failure"), false);
});
