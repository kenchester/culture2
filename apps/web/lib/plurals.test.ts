import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import IntlMessageFormat from "intl-messageformat";

// Renders the real catalogue strings, because a plural that reads well in
// a JSON file and throws at runtime has helped nobody. This is also the
// guard against machine translation ever mangling an ICU construct back
// in: invalid ICU fails here rather than on a live page.
function render(locale: string, dotted: string, values: Record<string, number>) {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  const messages = JSON.parse(fs.readFileSync(file, "utf8"));
  const message = dotted.split(".").reduce((o, k) => o[k], messages);
  return new IntlMessageFormat(message, locale).format(values) as string;
}

test("English says 1 member, not 1 members", () => {
  assert.equal(render("en", "network.memberPostCounts", { members: 1, posts: 1 }), "1 member, 1 post");
  assert.equal(render("en", "network.memberPostCounts", { members: 2, posts: 3 }), "2 members, 3 posts");
  assert.equal(render("en", "network.memberPostCounts", { members: 0, posts: 0 }), "0 members, 0 posts");
});

test("English counts elsewhere agree with themselves", () => {
  assert.equal(render("en", "elections.tally", { votes: 1 }), "1 vote");
  assert.equal(render("en", "elections.tally", { votes: 5 }), "5 votes");
  assert.equal(render("en", "city.missingPeople", { count: 1 }), "1 person here");
  assert.equal(render("en", "city.consulCount", { count: 1 }), "1 country keeps a consulate or mission here");
  assert.equal(render("en", "city.consulCount", { count: 87 }), "87 countries keep a consulate or mission here");
});

test("Russian picks one / few / many correctly", () => {
  // 1 -> one, 2 -> few, 5 -> many, 21 -> one, 11 -> many.
  const f = (n: number) => render("ru", "elections.tally", { votes: n });
  assert.equal(f(1), "1 голос");
  assert.equal(f(2), "2 голоса");
  assert.equal(f(5), "5 голосов");
  assert.equal(f(11), "11 голосов");
  assert.equal(f(21), "21 голос");
});

test("Arabic picks one / two / few / many correctly", () => {
  const f = (n: number) => render("ar", "elections.tally", { votes: n });
  assert.equal(f(1), "صوت واحد");
  assert.equal(f(2), "صوتان");
  assert.match(f(3), /أصوات/);
  assert.match(f(15), /صوتا/);
});

test("every locale renders every pluralised key without throwing", () => {
  const locales = ["en", "es", "fr", "de", "it", "pt", "ru", "ar", "zh", "ja", "ko"];
  const cases: [string, Record<string, number>][] = [
    ["network.memberPostCounts", { members: 1, posts: 1 }],
    ["network.memberPostCounts", { members: 7, posts: 22 }],
    ["searchResults.memberPostCounts", { members: 2, posts: 11 }],
    ["learn.memberPostCounts", { members: 1, posts: 0 }],
    ["network.metaDescription", { members: 1, posts: 1 }],
    ["network.viewAllReplies", { count: 4 }],
    ["elections.tally", { votes: 1 }],
    ["city.consulCount", { count: 87 }],
    ["city.missingPeople", { count: 1 }],
    ["city.foreignBorn", { count: 734716 }],
  ];
  for (const locale of locales) {
    for (const [key, values] of cases) {
      const out = render(locale, key, values);
      assert.ok(out.length > 0, `${locale} ${key} rendered empty`);
      // A leaked ICU keyword means the construct did not actually parse.
      assert.doesNotMatch(out, /\bplural\b|\bother\s*\{/, `${locale} ${key}: ${out}`);
    }
  }
});

test("large numbers are formatted by the locale, not pasted raw", () => {
  assert.match(render("en", "city.foreignBorn", { count: 734716 }), /734,716/);
  assert.match(render("de", "city.foreignBorn", { count: 734716 }), /734\.716/);
});
