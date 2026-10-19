import assert from "node:assert/strict";
import { test } from "node:test";
import { approximateFlightHours, greatCircleKm, kmToMiles } from "./distance";

// Real coordinates from the places table.
const NEW_YORK = { lat: 40.7143, lng: -74.006 };
const FUJIAN = { lat: 26.545, lng: 117.8428 };
const HOUSTON = { lat: 29.7633, lng: -95.3633 };
const DETROIT = { lat: 42.3314, lng: -83.0457 };

test("distance matches known great-circle figures", () => {
  // New York to Fujian is a little over 12,000 km.
  const far = greatCircleKm(NEW_YORK, FUJIAN)!;
  assert.ok(far > 12_000 && far < 13_000, String(far));
  // Detroit to Houston is roughly 1,750 km.
  const near = greatCircleKm(DETROIT, HOUSTON)!;
  assert.ok(near > 1_600 && near < 1_900, String(near));
});

test("distance is symmetric", () => {
  assert.equal(greatCircleKm(NEW_YORK, FUJIAN), greatCircleKm(FUJIAN, NEW_YORK));
});

test("a place with itself is zero", () => {
  assert.equal(greatCircleKm(HOUSTON, HOUSTON), 0);
});

test("missing coordinates give null, not a wrong number", () => {
  // Countries mostly have no coordinates in this dataset.
  assert.equal(greatCircleKm({ lat: null, lng: null }, NEW_YORK), null);
  assert.equal(greatCircleKm(NEW_YORK, { lat: 1, lng: null }), null);
});

test("miles conversion", () => {
  assert.equal(kmToMiles(1000), 621);
});

test("flight time is a plausible floor, to the half hour", () => {
  const hours = approximateFlightHours(greatCircleKm(NEW_YORK, FUJIAN)!);
  // A real NYC-to-Fujian itinerary is longer than this because it
  // connects; the estimate is explicitly air time only.
  assert.ok(hours >= 15 && hours <= 17, String(hours));
  assert.equal(hours % 0.5, 0);
});

import { distanceSpread } from "./distance";

const FUZHOU = { name: "Fuzhou", lat: 26.0614, lng: 119.3061 };
const XIAMEN = { name: "Xiamen", lat: 24.4798, lng: 118.0819 };
const NYC = { name: "New York City", lat: 40.7143, lng: -74.006 };

test("two single cities give an exact figure, not a range", () => {
  const spread = distanceSpread([XIAMEN], [NYC])!;
  assert.equal(spread.isRange, false);
  assert.equal(spread.nearestKm, spread.farthestKm);
  assert.equal(spread.nearestFrom, "Xiamen");
});

test("a region spreads between its nearest and farthest city", () => {
  const spread = distanceSpread([FUZHOU, XIAMEN], [NYC])!;
  assert.equal(spread.isRange, true);
  // Fuzhou is the northern coastal city and is the shorter hop.
  assert.equal(spread.nearestFrom, "Fuzhou");
  assert.equal(spread.farthestFrom, "Xiamen");
  assert.ok(spread.nearestKm < spread.farthestKm);
});

test("the spread names both endpoints so nothing is cherry-picked", () => {
  const spread = distanceSpread([FUZHOU, XIAMEN], [NYC])!;
  assert.equal(spread.nearestTo, "New York City");
  assert.equal(spread.farthestTo, "New York City");
});

test("places without coordinates are skipped, not counted as zero", () => {
  const spread = distanceSpread([{ name: "China", lat: null, lng: null }], [NYC]);
  assert.equal(spread, null);
});

test("identical duplicates do not fake a range", () => {
  const spread = distanceSpread([XIAMEN, { ...XIAMEN, name: "Xiamen copy" }], [NYC])!;
  assert.equal(spread.isRange, false);
});
