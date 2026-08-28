import type { ReactNode } from "react";
import { claimWhitelistSeat } from "@/lib/organization-whitelist";

// Wraps everything under /learn/[slug] (a school's public landing page, and -
// nested inside its own additional admin-only layout - its program-admin
// panel). Unauthenticated visitors pass through untouched (claimWhitelistSeat
// no-ops without a signed-in email); a signed-in visitor gets auto-enrolled
// here before anything else on the page renders, so e.g. a freshly-claimed
// admin's very next check (admin/layout.tsx's organization_admins lookup)
// already sees the seat this granted them.
export default async function LearnOrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await claimWhitelistSeat(slug);
  return <>{children}</>;
}
