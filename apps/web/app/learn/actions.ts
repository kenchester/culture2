"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
export async function checkSchoolDomain(formData: FormData) {
  const domain = normalizeDomain((formData.get("domain") as string) ?? "");

  if (!domain || !domain.includes(".")) {
    redirect(`/?domainError=${encodeURIComponent("Enter a valid school domain, like nyu.edu.")}`);
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("domain", domain)
    .maybeSingle();

  if (org) {
    redirect(`/?domainMatch=${encodeURIComponent(domain)}`);
  }

  await supabase.from("organization_leads").insert({ domain });
  redirect(`/?domainNoMatch=${encodeURIComponent(domain)}`);
}
