import assert from "node:assert/strict";
import { test } from "node:test";
import { censusCoverage, endangermentRank, isAtRisk } from "./language-reference";

// Real statuses from the Glottolog load.
test("the scale runs least to most endangered", () => {
  assert.ok(endangermentRank("threatened") < endangermentRank("moribund"));
  // Hawaiian is moribund, Tlingit nearly extinct.
  assert.ok(endangermentRank("moribund") < endangermentRank("nearly_extinct"));
  assert.ok(endangermentRank("nearly_extinct") < endangermentRank("extinct"));
});

test("an unknown or absent status ranks below the scale", () => {
  // Groups like Quechua carry no status, and must never sort as though
  // they were the healthiest thing on the page.
  assert.equal(endangermentRank(null), -1);
  assert.equal(endangermentRank("invented"), -1);
  assert.ok(endangermentRank(null) < endangermentRank("not_endangered"));
});

test("at risk starts at threatened, not at shifting", () => {
  assert.equal(isAtRisk("not_endangered"), false);
  assert.equal(isAtRisk("threatened"), true);
  assert.equal(isAtRisk("extinct"), true);
});

test("a language with no status is not claimed to be at risk", () => {
  assert.equal(isAtRisk(null), false);
});

test("an exact census category beats a lumped one", () => {
  // The ordering of the rows must not decide this.
  const labels = [
    { census_label: "Other Native languages of North America", is_exact: false },
    { census_label: "Navajo", is_exact: true },
  ];
  assert.equal(censusCoverage(labels)?.census_label, "Navajo");
});

test("a lumped category is still returned, so the page can caveat it", () => {
  // Cherokee's only category names 27 other languages. Returning null
  // here would hide the census's refusal to count it, which is the one
  // thing the page most needs to show.
  const labels = [
    { census_label: "Other Native languages of North America", is_exact: false },
  ];
  assert.equal(censusCoverage(labels)?.is_exact, false);
});

test("no category at all is distinct from a lumped one", () => {
  // Sign languages: B16001 asks what is spoken at home and never counts
  // them, so there is no figure to caveat.
  assert.equal(censusCoverage([]), null);
});
