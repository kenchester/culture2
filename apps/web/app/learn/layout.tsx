import type { ReactNode } from "react";
import { claimWhitelistSeat } from "@/lib/organization-whitelist";

// Wraps everything under /learn (the public landing page, the invite
// acceptance page, and - nested inside its own additional admin-only
// layout - the program-admin panel). Unauthenticated visitors pass through
// untouched (claimWhitelistSeat no-ops without a signed-in email); a
// signed-in visitor gets auto-enrolled here before anything else on the
// page renders, so e.g. a freshly-claimed admin's very next check
// (app/learn/admin/layout.tsx's organization_admins lookup) already sees
// the seat this granted them.
export default async function LearnLayout({ children }: { children: ReactNode }) {
  await claimWhitelistSeat();
  return <>{children}</>;
}
