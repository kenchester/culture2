"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { domainMatchCandidates } from "@/lib/school-domain";
import { sendSchoolVerificationCode } from "@/lib/school-email-verification";

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

// Backs the "Add a school network" link (app/learn/add-school-link.tsx),
// shown at the bottom of a real school's page for someone who belongs to
// more than one - unlike VerifySchoolEmailForm (which already knows which
// org it's verifying against, since it's rendered on that org's own page),
// this starts from just an email address and has to figure out which
// school it belongs to first. Reuses the exact same domain-match logic as
// checkSchoolDomain above, then - if a real (non-example school; Acme
// isn't something to "add") match is found - sends the verification code
// immediately and redirects straight to that school's page mid-flow
// (?verifyEmail=...), so VerifySchoolEmailForm there picks up at the code-
// entry step rather than making them type the email a second time.
export async function requestAddSchoolCode(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const backToSlug = formData.get("backToSlug") as string;
  const backTo = `/learn/${backToSlug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(backTo)}`);
  }
  if (!email || !email.includes("@")) {
    redirect(`${backTo}?addSchoolError=${encodeURIComponent("Enter a valid email address.")}`);
  }

  const domain = normalizeDomain(email.split("@")[1] ?? "");
  const { data: orgs } = await supabase
    .from("organizations")
    .select("slug, domain, is_example")
    .in("domain", domainMatchCandidates(domain));
  const org = (orgs ?? [])
    .filter((o) => !o.is_example)
    .sort((a, b) => b.domain!.length - a.domain!.length)[0];

  if (!org) {
    await supabase.from("organization_leads").insert({ domain });
    redirect(`${backTo}?addSchoolNoMatch=${encodeURIComponent(domain)}`);
  }

  const result = await sendSchoolVerificationCode(user.id, email);
  if (!result.ok) {
    redirect(`${backTo}?addSchoolError=${encodeURIComponent(result.error)}`);
  }

  redirect(`/learn/${org.slug}?verifyEmail=${encodeURIComponent(email)}`);
}
