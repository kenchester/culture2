import assert from "node:assert/strict";
import { test } from "node:test";
import {
  corridorIds,
  corridorIdsFromSlug,
  corridorSlug,
  idFromSlug,
  slugify,
  slugWithId,
} from "./slug";

test("slugify handles the names this dataset actually contains", () => {
  assert.equal(slugify("New York City"), "new-york-city");
  assert.equal(slugify("Hlavní město Praha"), "hlavni-mesto-praha");
  assert.equal(slugify("Zhytomyrs'ka Oblast'"), "zhytomyrska-oblast");
  assert.equal(slugify("Côte d'Ivoire"), "cote-divoire");
  assert.equal(slugify("People from El Salvador in Houston"), "people-from-el-salvador-in-houston");
});

test("a name with no Latin characters reduces to nothing, not to junk", () => {
  // The caller falls back to the bare id rather than emitting "-25420".
  assert.equal(slugify("厦门"), "");
  assert.equal(slugWithId("厦门", 7252), "7252");
});

test("truncation never leaves a trailing hyphen", () => {
  const slug = slugify("People from the Dominican Republic in New York City", 30);
  assert.ok(slug.length <= 30);
  assert.doesNotMatch(slug, /-$/);
});

test("the id survives a round trip from either form", () => {
  assert.equal(idFromSlug(slugWithId("Detroit", 25420)), 25420);
  assert.equal(idFromSlug("25420"), 25420);
  assert.equal(idFromSlug("detroit-michigan-25420"), 25420);
});

test("rubbish ids are rejected rather than queried for", () => {
  assert.equal(idFromSlug("detroit"), null);
  assert.equal(idFromSlug(""), null);
  assert.equal(idFromSlug("0"), null);
  assert.equal(idFromSlug("-5"), 5); // trailing digits win; the minus is a separator
});

test("a corridor resolves to one URL from either direction", () => {
  const fujian = { id: 841, name: "Fujian" };
  const nyc = { id: 25760, name: "New York City" };
  assert.equal(corridorSlug(fujian, nyc), corridorSlug(nyc, fujian));
  assert.equal(corridorSlug(fujian, nyc), "fujian-and-new-york-city-841-25760");
});

test("corridor ids come back in canonical order whichever way they went in", () => {
  assert.deepEqual(corridorIds(25760, 841), [841, 25760]);
  assert.deepEqual(corridorIds(841, 25760), [841, 25760]);
  assert.deepEqual(corridorIdsFromSlug("fujian-and-new-york-city-841-25760"), [841, 25760]);
  assert.deepEqual(corridorIdsFromSlug("841-25760"), [841, 25760]);
  assert.equal(corridorIdsFromSlug("fujian"), null);
});

test("a corridor between two non-Latin names still has a usable URL", () => {
  assert.equal(corridorSlug({ id: 7252, name: "厦门" }, { id: 198, name: "Singapore" }), "singapore-198-7252");
});
