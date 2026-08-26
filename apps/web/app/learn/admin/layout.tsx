import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Mirrors app/admin/layout.tsx's is_admin-gate pattern exactly, just
// checking organization_admins (tenant-scoped) instead of the global
// profiles.is_admin flag. Scoped to the "learn" org specifically, same as
// the landing page - this whole subtree only exists for Acme University
// today.
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
        as a program admin to continue.
      </div>
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("subdomain", "learn")
    .single();

  if (!org) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not configured.</div>;
  }

  const { data: membership } = await supabase
    .from("organization_admins")
    .select("user_id")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not authorized.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl text-ink">{org.name} admin</h1>
      {children}
    </div>
  );
}
