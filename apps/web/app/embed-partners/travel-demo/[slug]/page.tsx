import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const navLinks = ["Buses", "Trains", "Flights", "Deals", "Help"];

const valueProps = [
  { label: "Compare prices instantly" },
  { label: "Book in a couple of taps" },
  { label: "24/7 traveler support" },
  { label: "Trusted by travelers worldwide" },
];

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#8a93a6]">
      <path
        d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M7 7h11m0 0-3.5-3.5M18 7l-3.5 3.5M17 17H6m0 0 3.5-3.5M6 17l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#8a93a6]">
      <rect x="4" y="5.5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#8a93a6]">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-[#8a93a6]">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A generic travel-booking-site preset, styled after the layout/color
// language common to sites like wanderu.com (white background, blue
// accents, search-widget-in-hero pattern) - not a copy of any specific
// brand's name, logo, or copy, same "reusable concept preview" approach as
// the embassy-styled demo, just a different look for pitching to a
// different kind of prospect.
export default async function EmbedPartnerTravelDemoPage({
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
    <div className="flex min-h-full flex-col bg-white font-sans text-[#1a2333]">
      {/* Preview disclosure bar - same honest-labeling convention as the
          other demo presets. */}
      <div className="flex items-center justify-center gap-2 bg-[#eef4ff] px-4 py-2 text-center text-xs text-[#1a2333]">
        <span>
          CultureMesh embed concept preview, built for {partner.name} &mdash;
          not an official travel booking site.
        </span>
        <Link href="/" className="font-medium underline">
          About CultureMesh
        </Link>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#e5e9f0] px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#155eef] text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M21 3 3 10.5l7 2.5 2 7L21 3Z" />
            </svg>
          </span>
          <span className="text-lg font-semibold text-[#1a2333]">{partner.name}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#4b5875] sm:flex">
          {navLinks.map((link) => (
            <span key={link} className="cursor-default hover:text-[#155eef]">
              {link}
            </span>
          ))}
        </nav>
        <span className="rounded-md bg-[#155eef] px-4 py-2 text-sm font-medium text-white">
          Sign in
        </span>
      </header>

      {/* Hero, with the embed standing in for the usual search widget */}
      <section className="bg-gradient-to-b from-[#f5f8ff] to-white px-6 py-16 sm:px-10 sm:py-20">
        {/* Purely decorative - mocked to read as a typical travel booking
            search bar at a glance, not a working form. */}
        <div className="mx-auto mb-10 flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-[#e5e9f0] bg-white p-5 shadow-md">
          <div className="flex gap-6 text-sm font-medium text-[#1a2333]">
            <span className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#155eef]">
                <span className="h-2 w-2 rounded-full bg-[#155eef]" />
              </span>
              One way
            </span>
            <span className="flex items-center gap-2 text-[#8a93a6]">
              <span className="h-4 w-4 rounded-full border-2 border-[#c7cedb]" />
              Round trip
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="flex flex-1 items-center gap-2 rounded-md border border-[#e5e9f0] px-3 py-2.5">
              <PinIcon />
              <span className="text-sm text-[#8a93a6]">City or station</span>
            </span>
            <span className="hidden h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-[#e5e9f0] text-[#8a93a6] sm:flex">
              <SwapIcon />
            </span>
            <span className="flex flex-1 items-center gap-2 rounded-md border border-[#e5e9f0] px-3 py-2.5">
              <PinIcon />
              <span className="text-sm text-[#8a93a6]">City or station</span>
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap rounded-md border border-[#e5e9f0] px-3 py-2.5">
              <CalendarIcon />
              <span className="text-sm text-[#1a2333]">Tue, Aug 11</span>
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap rounded-md border border-[#e5e9f0] px-3 py-2.5">
              <PersonIcon />
              <span className="text-sm text-[#1a2333]">1 Passenger</span>
              <ChevronIcon />
            </span>
            <span className="cursor-default rounded-md bg-[#155eef] px-6 py-2.5 text-center text-sm font-semibold text-white">
              Search
            </span>
          </div>
        </div>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <h1 className="text-4xl font-bold text-[#1a2333] sm:text-5xl">
            Fresh ways to wander
          </h1>
          <p className="max-w-md text-[#4b5875]">
            Landing somewhere new? Find your community, wherever your trip
            takes you.
          </p>
        </div>

        {/* The actual embed, exactly as a partner would receive it */}
        <div className="mx-auto mt-10 w-full max-w-2xl overflow-hidden rounded-xl border border-[#e5e9f0] bg-white shadow-lg">
          <iframe
            src={embedUrl}
            style={{ width: "100%", height: 640, border: "none", display: "block" }}
            title="CultureMesh"
          />
        </div>
      </section>

      {/* Value props, matching the icon-row pattern common to booking sites */}
      <section className="px-6 py-14 sm:px-10">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {valueProps.map((prop) => (
            <div
              key={prop.label}
              className="flex flex-col items-center gap-3 rounded-lg border border-[#e5e9f0] p-5 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#155eef]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-medium text-[#1a2333]">{prop.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#e5e9f0] bg-[#f7f9fc] px-6 py-10 text-sm text-[#4b5875] sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 border-b border-[#e5e9f0] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#155eef] text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <span className="text-[#1a2333]">{partner.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {["About", "Routes", "Privacy Policy", "Help"].map((link) => (
              <span key={link} className="cursor-default underline decoration-[#e5e9f0]">
                {link}
              </span>
            ))}
          </div>
        </div>
        <p className="mx-auto max-w-3xl pt-4 text-xs text-[#8a93a6]">
          This page is a concept preview generated by CultureMesh to
          demonstrate an embedded network search for {partner.name}. It is
          not affiliated with or published by any travel booking company.
        </p>
      </footer>
    </div>
  );
}
