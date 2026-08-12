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
