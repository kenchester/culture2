"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { LanguageSwitcher } from "@/app/language-switcher";

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

function UserMenu({ user, profile, hasSchools }: { user: User; profile: Profile | null; hasSchools: boolean }) {
  const t = useTranslations("nav");
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
            {t("profile")}
          </Link>
          <Link
            href="/my-networks"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
          >
            {t("myNetworks")}
          </Link>
          {hasSchools && (
            <Link
              href="/schools"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
            >
              {t("schools")}
            </Link>
          )}
          <Link
            href="/messages"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
          >
            {t("messages")}
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
          >
            {t("settings")}
          </Link>
          {profile?.is_admin && (
            <Link
              href="/admin/embed-partners"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-body hover:bg-primary-light hover:text-primary"
            >
              {t("admin")}
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full border-t border-border px-3 py-2 text-left text-body hover:bg-primary-light hover:text-primary"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Nav({ isLearnHost = false }: { isLearnHost?: boolean }) {
  const t = useTranslations("nav");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasSchools, setHasSchools] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

    // Gates the dropdown's "Schools" item (app/schools/page.tsx) - only
    // recognition at a real school counts, same is_example exclusion as
    // that page's own query, so the item never appears for someone whose
    // only "membership" is poking around the Acme demo as an admin.
    async function loadHasSchools(userId: string) {
      const { data } = await supabase
        .from("organization_whitelist")
        .select("organization:organizations!inner(is_example)")
        .eq("claimed_by", userId)
        .eq("organizations.is_example", false)
        .limit(1);
      setHasSchools((data?.length ?? 0) > 0);
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadProfile(data.user.id);
        loadHasSchools(data.user.id);
      } else {
        setProfile(null);
        setHasSchools(false);
      }
    });
    // Every sign-in/sign-up/sign-out in this app happens through a server
    // action, not a client-side supabase.auth call, so onAuthStateChange
    // below never actually fires for them - it only reacts to auth calls
    // made by this same browser client. What does reliably follow a
    // server action is a pathname change (the redirect() at the end of
    // each one), so re-checking on every navigation is what actually
    // keeps this in sync instead of requiring a full page reload.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        loadHasSchools(session.user.id);
      } else {
        setProfile(null);
        setHasSchools(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [pathname]);

  // Embed pages, and any page reached while staying inside a partner's
  // iframe (?embed=1), must render with no CultureMesh chrome - they're
  // meant to be indistinguishable from the partner's own site.
  if (
    pathname?.startsWith("/embed/") ||
    pathname?.startsWith("/embed-partners/demo/") ||
    pathname?.startsWith("/embed-partners/travel-demo/") ||
    pathname?.startsWith("/embed-partners/remittance-demo/") ||
    searchParams.get("embed") === "1"
  ) {
    return null;
  }

  // So clicking "Sign in"/"Sign up" from anywhere (a specific network page,
  // the learn. landing page, ...) brings the visitor back to exactly where
  // they were, not always to "/" - the nav's own sign-in link previously
  // had no returnTo at all, unlike the page-level ones (e.g.
  // app/networks/[id]/page.tsx's own signInHref) that already did this.
  const currentPath = pathname && pathname !== "/sign-in" ? pathname : "/";
  const query = searchParams.toString();
  const returnTo = query ? `${currentPath}?${query}` : currentPath;
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <nav className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-y-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-sm sm:px-6">
      <Link href="/" className="flex items-center">
        <Logo className="h-8" priority />
      </Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {/* "Search" also finds real native/heritage speakers outside a
            school's closed network (see getSuggestedSpeakerNetwork, app/
            networks/[id]/page.tsx) - worth keeping on learn-hosted pages
            too, but relabeled so it reads as "the wider site", not part
            of the school's own gated network, given the redirect above
            (app/networks/[id]/page.tsx) already sends whatever you find
            here back to the plain host anyway. */}
        <NavLink href="/search">{isLearnHost ? t("searchPublicNetworks") : t("search")}</NavLink>
        <LanguageSwitcher />
        {user ? (
          <UserMenu user={user} profile={profile} hasSchools={hasSchools} />
        ) : (
          <>
            <NavLink href={signInHref}>{t("signIn")}</NavLink>
            <Link
              href={signInHref}
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {t("signUp")}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
