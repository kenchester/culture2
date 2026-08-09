"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // Embed pages must render with no CultureMesh chrome - they're meant to
  // be indistinguishable from the partner's own site when iframed.
  if (pathname?.startsWith("/embed/")) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-surface px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
        <p>&copy; {new Date().getFullYear()} CultureMesh LLC. All rights reserved.</p>
        <div className="flex items-center gap-5">
          <Link href="/about" className="hover:text-primary">
            About Us
          </Link>
          <Link href="/privacy" className="hover:text-primary">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-primary">
            Terms and Conditions
          </Link>
          <Link href="/contact" className="hover:text-primary">
            Contact Us
          </Link>
        </div>
      </div>
    </footer>
  );
}
