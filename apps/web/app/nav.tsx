"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";
import { LogoMark } from "@/components/logo";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`transition-colors hover:text-primary ${
        isActive ? "font-medium text-primary" : "text-body"
      }`}
    >
      {children}
    </Link>
  );
}

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    async function loadAdminFlag(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();
      setIsAdmin(data?.is_admin ?? false);
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadAdminFlag(data.user.id);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAdminFlag(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Embed pages must render with no CultureMesh chrome - they're meant to
  // be indistinguishable from the partner's own site when iframed.
  if (pathname?.startsWith("/embed/")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-y-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-sm sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-ink">
        <LogoMark className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">CultureMesh</span>
      </Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <NavLink href="/search">Search</NavLink>
        {user ? (
          <>
            <NavLink href="/messages">Messages</NavLink>
            <NavLink href={`/profile/${user.id}`}>Profile</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            {isAdmin && <NavLink href="/admin/embed-partners">Admin</NavLink>}
            <form action={signOut}>
              <button
                type="submit"
                className="text-body transition-colors hover:text-primary"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <NavLink href="/sign-in">Sign in</NavLink>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
