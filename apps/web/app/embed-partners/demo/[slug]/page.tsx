import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const navLinks = ["About", "Services", "Visas", "News", "Contact", "Consulates"];

const infoCards = [
  { label: "Consular Services" },
  { label: "Passports & Visas" },
  { label: "Travel Advisories" },
  { label: "Community Events" },
];

export default async function EmbedPartnerDemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("embed_partners")
    .select("name, slug")
    .eq("slug", slug)
    .single();

  if (!partner) {
    notFound();
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const embedUrl = `${protocol}://${host}/embed/${partner.slug}`;

  return (
    <div className="flex min-h-full flex-col bg-white font-serif text-[#1c2b24]">
      {/* Preview disclosure bar - honest labeling, styled like the utility
          bar diplomatic sites use for official-source disclosures. */}
      <div className="flex items-center justify-center gap-2 bg-[#e8f3ee] px-4 py-2 text-center text-xs text-[#1c2b24]">
        <span>
          CultureMesh embed concept preview, built for {partner.name} &mdash;
          not an official government website.
        </span>
        <Link href="/" className="font-medium underline">
          About CultureMesh
        </Link>
      </div>

      {/* Primary header */}
      <header className="flex items-center justify-between bg-[#0b2e22] px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d4b483] text-[#d4b483]">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M3 12h18M12 3c2.4 2.6 3.6 5.7 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.7-3.6-9s1.2-6.4 3.6-9Z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </span>
          <span className="text-lg tracking-wide text-white">{partner.name}</span>
        </div>
        <div className="hidden items-center gap-2 text-[#d4b483] sm:flex">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </header>

      {/* Secondary nav */}
      <nav className="flex flex-wrap items-center gap-x-8 gap-y-2 bg-[#163f30] px-6 py-3 text-sm text-[#e8f3ee] sm:px-10">
        {navLinks.map((link) => (
          <span
            key={link}
            className="cursor-default border-b border-transparent pb-0.5 hover:border-[#d4b483]"
          >
            {link}
          </span>
        ))}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b2e22] via-[#163f30] to-[#1c4d3d] px-6 py-20 text-center sm:px-10 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 14px)",
          }}
        />
        <div className="relative mx-auto flex max-w-2xl flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d4b483]">
            Diaspora &amp; Community Affairs
          </p>
          <h1 className="text-4xl font-medium text-white sm:text-5xl">{partner.name}</h1>
          <p className="text-[#dce9e2]">
            Find and connect with fellow community members, wherever you live
            today.
          </p>
        </div>
      </section>

      {/* The actual embed, exactly as a partner would receive it */}
      <section className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-10">
        <div className="flex flex-col gap-2 pb-6 text-center">
          <h2 className="text-2xl text-[#0b2e22]">Connect with the Community</h2>
          <p className="text-sm text-[#4a423c]">
            Search by where you live now to find your local network.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#d9d2c4] shadow-sm">
          <iframe
            src={embedUrl}
            style={{ width: "100%", height: 640, border: "none", display: "block" }}
            title="CultureMesh"
          />
        </div>
      </section>

      {/* Info cards, matching the icon-card pattern common to embassy sites */}
      <section className="bg-[#f7f5f0] px-6 py-14 sm:px-10">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {infoCards.map((card) => (
            <div
              key={card.label}
              className="flex flex-col items-center gap-3 rounded-md bg-white p-5 text-center shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b2e22] text-[#d4b483]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4 10h16" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              <span className="text-sm font-medium text-[#1c2b24]">{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#efece4] px-6 py-10 text-sm text-[#4a423c] sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 border-b border-[#d9d2c4] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0b2e22] text-[#0b2e22]">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <span className="text-[#1c2b24]">{partner.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {["About", "Services", "Privacy Policy", "Contact"].map((link) => (
              <span key={link} className="cursor-default underline decoration-[#d9d2c4]">
                {link}
              </span>
            ))}
          </div>
        </div>
        <p className="mx-auto max-w-3xl pt-4 text-xs text-[#857a70]">
          This page is a concept preview generated by CultureMesh to
          demonstrate an embedded network search for {partner.name}. It is
          not affiliated with or published by any government.
        </p>
      </footer>
    </div>
  );
}
