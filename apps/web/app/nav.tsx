"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";

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

type Profile = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  img_path: string | null;
  is_admin: boolean;
};

function UserMenu({ user, profile }: { user: User; profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const displayName = profile ? getDisplayName(profile) : user.email;
  const avatarUrl = profile ? getAvatarUrl(supabase, profile.img_path) : null;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full text-body transition-colors hover:text-primary"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">
            {displayName?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
        <span className="max-w-[10rem] truncate text-sm">{displayName}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-md border border-border bg-surface py-1 text-sm shadow-md">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate font-medium text-ink">{displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link
            href={`/profile/${user.id}`}
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
          >
            Profile
          </Link>
          <Link
            href="/messages"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
          >
            Messages
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
          >
            Settings
          </Link>
          {profile?.is_admin && (
            <Link
              href="/admin/embed-partners"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
            >
              Admin
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full border-t border-border px-3 py-2 text-left text-body hover:bg-primary-light hover:text-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("username, first_name, last_name, img_path, is_admin")
        .eq("id", userId)
        .single();
      setProfile(data ?? null);
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadProfile(data.user.id);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Embed pages must render with no CultureMesh chrome - they're meant to
  // be indistinguishable from the partner's own site when iframed.
  if (pathname?.startsWith("/embed/") || pathname?.startsWith("/embed-partners/demo/")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-y-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-sm sm:px-6">
      <Link href="/" className="flex items-center">
        <Logo className="h-8" priority />
      </Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <NavLink href="/search">Search</NavLink>
        {user ? (
          <UserMenu user={user} profile={profile} />
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
