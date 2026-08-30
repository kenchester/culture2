"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { domainMatchCandidates } from "@/lib/school-domain";

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

// Backs the landing page's domain-check banner. A match tells the visitor
// their school is already on CultureMesh; no match still points them at
// the example networks below (the point of the banner either way) but also
// captures the domain as a lead, so a "not yet" answer isn't a dead end.
// Always redirects back to the page the banner was embedded on (the current
// slug), not to whichever org's domain happened to match - the banner is a
// widget on that school's own landing page, not a school finder.
export async function checkSchoolDomain(formData: FormData) {
  const slug = formData.get("slug") as string;
  const domain = normalizeDomain((formData.get("domain") as string) ?? "");
  const backTo = `/learn/${slug}`;

  if (!domain || !domain.includes(".")) {
    redirect(`${backTo}?domainError=${encodeURIComponent("Enter a valid school domain, like nyu.edu.")}`);
  }

  const supabase = await createClient();
  // Recognizes a subdomain of an org's registered domain too (e.g. an org
  // registered as "grcc.edu" also matches "email.grcc.edu") - most specific
  // match wins if more than one candidate happens to be registered.
  const { data: orgs } = await supabase
    .from("organizations")
    .select("slug, domain")
    .in("domain", domainMatchCandidates(domain));
  const org = (orgs ?? []).sort((a, b) => b.domain!.length - a.domain!.length)[0];

  if (org) {
    redirect(`${backTo}?domainMatch=${encodeURIComponent(domain)}`);
  }

  await supabase.from("organization_leads").insert({ domain });
  redirect(`${backTo}?domainNoMatch=${encodeURIComponent(domain)}`);
}

// The login-time smart redirect: someone signing in from the bare /learn
// entry point (not yet on any specific school's page) should land on their
// own school's page if their verified email's domain matches one, rather
// than the generic root. Only ever called with an already-verified email
// (see otp-form.tsx's trySettle), so a match here is trustworthy enough to
// redirect on without any further confirmation step.
export async function resolveLearnSlugForEmail(email: string): Promise<string | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return null;
  }

  const supabase = await createClient();
  // Same subdomain-aware match as checkSchoolDomain above - a verified
  // student@email.grcc.edu should resolve to a school registered as
  // "grcc.edu", not just an exact domain match.
  const { data: orgs } = await supabase
    .from("organizations")
    .select("slug, domain")
    .in("domain", domainMatchCandidates(domain));
  const org = (orgs ?? []).sort((a, b) => b.domain!.length - a.domain!.length)[0];
  return org?.slug ?? null;
}
