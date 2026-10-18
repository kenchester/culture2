import assert from "node:assert/strict";
import { test } from "node:test";
import { partnerIsInside } from "./place-containment";

// Real ids from the production data these cases came from.
const FUJIAN = 841;
const CHINA = 48;
const BEIJING = 7663;
const BEIJING_SHI = 839;
const NEW_YORK_CITY = 25760;
const MEXICO = 157;

const beijingChain = [BEIJING, BEIJING_SHI, CHINA];

test("a sister city counts for the country that contains it", () => {
  assert.equal(partnerIsInside(beijingChain, CHINA), true);
});

test("two places sharing a country are not inside each other", () => {
  // The bug this file exists for. New York is twinned with Beijing, and
  // that is not a tie to Fujian - both are merely in China.
  assert.equal(partnerIsInside(beijingChain, FUJIAN), false);
});

test("a sister city counts for itself", () => {
  assert.equal(partnerIsInside(beijingChain, BEIJING), true);
});

test("an unrelated place never matches", () => {
  assert.equal(partnerIsInside(beijingChain, MEXICO), false);
  assert.equal(partnerIsInside(beijingChain, NEW_YORK_CITY), false);
});

test("an empty chain matches nothing", () => {
  assert.equal(partnerIsInside([], CHINA), false);
});
