import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLearnAccess } from "@/lib/organization-whitelist";

// Mirrors app/admin/layout.tsx's is_admin-gate pattern, extended beyond
// org admins: an instructor (a claimed organization_whitelist role, see
// getLearnAccess) can also reach this panel now, to set their network's
// weekly prompt and see who's participating - just not the
// whitelist-management section, which page.tsx keeps admin-only. Scoped
// to the "learn" org specifically, same as the landing page - this whole
// subtree only exists for Acme University today.
export default async function LearnAdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-body">
        <Link href="/sign-in?returnTo=%2Fadmin" className="font-medium text-primary hover:underline">
          Sign in
        </Link>{" "}
        as a program admin or instructor to continue.
      </div>
    );
  }

  const { org, role } = await getLearnAccess();

  if (!org) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not configured.</div>;
  }

  if (!role) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not authorized.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl text-ink">
        {org.name} {role === "admin" ? "admin" : "instructor"}
      </h1>
      {children}
    </div>
  );
}
