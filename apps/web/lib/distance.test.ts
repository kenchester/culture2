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
