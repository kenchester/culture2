import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTINENTS, continentOf, groupByContinent } from "./continents";

test("maps the obvious cases", () => {
  assert.equal(continentOf("NG"), "africa");
  assert.equal(continentOf("MX"), "americas");
  assert.equal(continentOf("US"), "americas");
  assert.equal(continentOf("JP"), "asia");
  assert.equal(continentOf("FR"), "europe");
});

test("Australia and New Zealand are Oceania, as asked", () => {
  assert.equal(continentOf("AU"), "oceania");
  assert.equal(continentOf("NZ"), "oceania");
  assert.equal(continentOf("PG"), "oceania");
});

test("transcontinental countries follow UN M49 rather than a guess", () => {
  // The ones a reader is most likely to query.
  assert.equal(continentOf("TR"), "asia");
  assert.equal(continentOf("CY"), "asia");
  assert.equal(continentOf("GE"), "asia");
  assert.equal(continentOf("AM"), "asia");
  assert.equal(continentOf("AZ"), "asia");
  assert.equal(continentOf("RU"), "europe");
});

test("is case-insensitive and safe on an unknown code", () => {
  assert.equal(continentOf("ng"), "africa");
  assert.equal(continentOf("ZZ"), null);
  assert.equal(continentOf(""), null);
});

test("no country is listed under two continents", () => {
  const seen = new Map<string, string>();
  for (const continent of CONTINENTS) {
    for (const code of ["AF", "US", "FR", "AU", "NG", "TR", "RU", "BR", "CN", "EG"]) {
      const found = continentOf(code);
      if (found === continent) {
        assert.equal(seen.has(code), false, `${code} appears twice`);
        seen.set(code, continent);
      }
    }
  }
  assert.equal(seen.size, 10);
});

test("groups in continent order and drops empty groups", () => {
  const rows = [
    { iso: "FR" },
    { iso: "NG" },
    { iso: "JP" },
    { iso: "DE" },
    { iso: "ZZ" },
  ];
  const grouped = groupByContinent(rows, (r) => r.iso);
  assert.deepEqual(
    grouped.map((g) => g.continent),
    // africa, asia, europe, other - americas and oceania are absent, not empty.
    ["africa", "asia", "europe", "other"],
  );
  assert.deepEqual(
    grouped.find((g) => g.continent === "europe")!.items.map((r) => r.iso),
    ["FR", "DE"],
  );
  // An unmapped code is kept and shown last rather than silently dropped.
  assert.deepEqual(grouped.at(-1)!.items.map((r) => r.iso), ["ZZ"]);
});
