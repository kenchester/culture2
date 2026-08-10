import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminTabs } from "@/app/admin/admin-tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-body">
        Sign in as an admin to continue.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not authorized.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Admin</h1>
      <AdminTabs />
      {children}
    </div>
  );
}
