"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";

export function Nav() {
  const [user, setUser] = useState<User | null>(null);

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

  return (
    <nav className="flex items-center justify-between border-b px-4 py-3">
      <Link href="/" className="font-semibold">
        CultureMesh
      </Link>
      <div className="flex items-center gap-4 text-sm">
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
