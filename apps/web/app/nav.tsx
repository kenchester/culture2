"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Embed pages must render with no CultureMesh chrome - they're meant to
  // be indistinguishable from the partner's own site when iframed.
  if (pathname?.startsWith("/embed/")) {
    return null;
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-y-2 border-b px-4 py-3">
      <Link href="/" className="font-semibold">
        CultureMesh
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href="/search" className="underline">
          Search
        </Link>
        {user ? (
          <>
            <Link href="/messages" className="underline">
              Messages
            </Link>
            <Link href={`/profile/${user.id}`} className="underline">
              Profile
            </Link>
            <Link href="/settings" className="underline">
              Settings
            </Link>
            <form action={signOut}>
              <button type="submit" className="underline">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
            <Link href="/sign-up" className="underline">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
