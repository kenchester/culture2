import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const navLinks = ["About", "Services", "Visas", "News", "Contact", "Consulates"];

const quickLinks = [
  {
    label: "Consular Services",
    description: "Notarizations, document authentication, and civil registry support.",
  },
  {
    label: "Passports & Visas",
    description: "Renewals, applications, and travel-document guidance.",
  },
  {
    label: "Travel Advisories",
    description: "Current guidance for citizens traveling or residing abroad.",
  },
  {
    label: "Community Events",
    description: "Cultural gatherings and briefings hosted throughout the year.",
  },
  {
    label: "Consular Registration",
    description: "Register your residence abroad to receive official updates.",
  },
  {
    label: "Emergency Assistance",
    description: "Support for citizens facing an emergency while overseas.",
  },
];

const announcements = [
  {
    date: "This month",
    title: "Community town hall scheduled in multiple regions",
    body: "An open session for citizens abroad to raise questions with visiting staff.",
  },
  {
    date: "This month",
    title: "Passport renewal processing times updated",
    body: "Current estimated turnaround for standard and expedited applications.",
  },
  {
    date: "This month",
    title: "Cultural exchange program accepting applications",
    body: "A new cycle opens for community members interested in participating.",
  },
];

const stats = [
  { value: "180+", label: "Countries with registered community members" },
  { value: "24/7", label: "Consular-style support availability" },
  { value: "10,000+", label: "Community members connected through this network" },
];

// A generic circular emblem - a compass star inside a laurel-style ring -
// used to read as an official seal without depicting any real country's
// coat of arms or other protected national symbol.
function Emblem({
  className,
  ariaHidden,
}: {
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden={ariaHidden}>
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="16.5" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
      <path
        d="M24 11.5 26.6 21.4 36.5 24 26.6 26.6 24 36.5 21.4 26.6 11.5 24 21.4 21.4 24 11.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const x1 = 24 + Math.cos(angle) * 18.5;
        const y1 = 24 + Math.sin(angle) * 18.5;
        const x2 = 24 + Math.cos(angle) * 20.5;
        const y2 = 24 + Math.sin(angle) * 20.5;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 3.5 19.5 6.5V11c0 5.2-3.2 8.7-7.5 9.5C7.7 19.7 4.5 16.2 4.5 11V6.5L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m8.7 12 2.2 2.2 4.4-4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4M9 12.5h6M9 16h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 4 21.5 20H2.5L12 4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 10.5V14.5M12 17h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="4" y="5.5" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="6" y="4.5" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 4.5V3.5h5v1M9 12.5l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LifeRingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="m6.4 6.4 3.4 3.4M17.6 6.4l-3.4 3.4M6.4 17.6l3.4-3.4M17.6 17.6l-3.4-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
      <path d="M9.8 6.5C6.6 7.9 5 10.1 5 13c0 2.3 1.5 3.9 3.5 3.9 1.7 0 3-1.3 3-3 0-1.6-1.1-2.8-2.6-2.9.4-1.5 1.7-2.8 3.4-3.6L9.8 6.5Zm8.4 0C15 7.9 13.4 10.1 13.4 13c0 2.3 1.5 3.9 3.5 3.9 1.7 0 3-1.3 3-3 0-1.6-1.1-2.8-2.6-2.9.4-1.5 1.7-2.8 3.4-3.6l-2.5-.9Z" />
    </svg>
  );
}

const quickLinkIcons = [CheckShieldIcon, DocumentIcon, AlertIcon, CalendarIcon, ClipboardIcon, LifeRingIcon];

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

      {/* Utility bar - the thin, dense strip common atop official
          government sites (language toggle, search, official framing). */}
      <div className="flex items-center justify-between bg-[#081b14] px-6 py-1.5 font-sans text-[11px] text-[#a9c2b6] sm:px-10">
        <span className="hidden tracking-wide sm:inline">
          Official Diaspora &amp; Community Affairs Portal
        </span>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <span className="flex items-center gap-1 border-r border-[#1f3d31] pr-4">
            EN
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="flex items-center gap-1.5">
            <SearchIcon />
            Search
          </span>
        </div>
      </div>

      {/* Primary header */}
      <header className="flex items-center justify-between bg-[#0b2e22] px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center text-[#d4b483]">
            <Emblem className="h-11 w-11" />
          </span>
          <div className="flex flex-col">
            <span className="text-lg leading-tight tracking-wide text-white">{partner.name}</span>
            <span className="font-sans text-[11px] uppercase tracking-[0.15em] text-[#8ea99a]">
              Diaspora &amp; Community Affairs
            </span>
          </div>
        </div>
        <span className="hidden items-center gap-2 rounded-sm border border-[#d4b483] px-4 py-2 font-sans text-xs font-medium tracking-wide text-[#d4b483] sm:flex">
          Contact Us
        </span>
      </header>

      {/* Secondary nav */}
      <nav className="flex flex-wrap items-center gap-x-8 gap-y-2 bg-[#163f30] px-6 py-3 font-sans text-sm text-[#e8f3ee] sm:px-10">
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b2e22] via-[#163f30] to-[#1c4d3d] px-6 py-20 sm:px-10 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 14px)",
          }}
        />
        <Emblem
          ariaHidden
          className="pointer-events-none absolute -right-24 top-1/2 hidden h-[26rem] w-[26rem] -translate-y-1/2 text-[#d4b483] opacity-[0.08] lg:block"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col gap-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d4b483]">
            Diaspora &amp; Community Affairs
          </p>
          <h1 className="text-4xl font-medium text-white sm:text-5xl">{partner.name}</h1>
          <p className="max-w-lg text-[#dce9e2]">
            Find and connect with fellow community members, wherever you live
            today. A trusted, official channel for citizens abroad.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 font-sans text-sm">
            <span className="cursor-default rounded-sm bg-[#d4b483] px-6 py-2.5 font-medium text-[#0b2e22]">
              Register With Us
            </span>
            <span className="cursor-default border-b border-[#d4b483] pb-0.5 font-medium text-[#e8f3ee]">
              Learn More
            </span>
          </div>
        </div>
      </section>

      {/* Trust stats strip */}
      <section className="border-b border-[#e5ded0] bg-[#f7f5f0] px-6 py-8 sm:px-10">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 divide-y divide-[#e5ded0] text-center sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 pt-6 first:pt-0 sm:pt-0">
              <span className="text-2xl font-medium text-[#0b2e22]">{stat.value}</span>
              <span className="font-sans text-xs text-[#6b6156]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The actual embed, exactly as a partner would receive it */}
      <section className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-10">
        <div className="overflow-hidden rounded-lg border border-[#d9d2c4] shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-[#0b2e22] via-[#d4b483] to-[#0b2e22]" />
          <div className="flex flex-col gap-2 px-6 pb-6 pt-8 text-center">
            <h2 className="text-2xl text-[#0b2e22]">Connect with the Community</h2>
            <p className="text-sm text-[#4a423c]">
              Search by where you live now to find your local network.
            </p>
          </div>
          <iframe
            src={embedUrl}
            style={{ width: "100%", height: 640, border: "none", display: "block" }}
            title="CultureMesh"
          />
        </div>
      </section>

      {/* Ambassador's message - role-attributed, not a specific invented
          person, so the demo doesn't put words in anyone's mouth. */}
      <section className="bg-[#0b2e22] px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <span className="text-[#d4b483]">
            <QuoteIcon />
          </span>
          <p className="max-w-2xl text-xl font-medium leading-relaxed text-white sm:text-2xl">
            &ldquo;Wherever our citizens live, we want them to feel within
            reach of home. This platform is one more way we stay
            connected to the community we serve.&rdquo;
          </p>
          <div className="flex items-center gap-3 font-sans">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4b483] text-[#d4b483]">
              <Emblem className="h-6 w-6" />
            </span>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-white">Office of the Ambassador</span>
              <span className="text-xs text-[#8ea99a]">{partner.name}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick links, matching the icon-card pattern common to embassy sites */}
      <section className="bg-[#f7f5f0] px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 pb-8 text-center">
          <h2 className="text-2xl text-[#0b2e22]">Services &amp; Resources</h2>
          <p className="text-sm text-[#4a423c]">Quick access to what citizens need most.</p>
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((card, i) => {
            const Icon = quickLinkIcons[i];
            return (
              <div
                key={card.label}
                className="flex flex-col gap-3 rounded-md border border-[#e5ded0] bg-white p-5 text-left shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b2e22] text-[#d4b483]">
                  <Icon />
                </span>
                <span className="text-sm font-semibold text-[#1c2b24]">{card.label}</span>
                <span className="font-sans text-xs leading-relaxed text-[#6b6156]">
                  {card.description}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* News & announcements */}
      <section className="px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 pb-8 text-center">
          <h2 className="text-2xl text-[#0b2e22]">News &amp; Announcements</h2>
          <p className="text-sm text-[#4a423c]">Updates from our diaspora affairs office.</p>
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
          {announcements.map((item) => (
            <div key={item.title} className="flex flex-col gap-2 border-t-2 border-[#0b2e22] pt-4">
              <span className="font-sans text-xs uppercase tracking-wide text-[#a08b5f]">
                {item.date}
              </span>
              <span className="font-medium text-[#1c2b24]">{item.title}</span>
              <span className="font-sans text-sm leading-relaxed text-[#6b6156]">{item.body}</span>
              <span className="mt-1 cursor-default font-sans text-xs font-medium text-[#0b2e22] underline">
                Read more
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#efece4] px-6 pt-14 font-sans text-sm text-[#4a423c] sm:px-10">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 pb-10 sm:grid-cols-4">
          <div className="flex flex-col gap-3 sm:col-span-1">
            <span className="flex h-9 w-9 items-center justify-center text-[#0b2e22]">
              <Emblem className="h-9 w-9" />
            </span>
            <span className="font-serif text-base text-[#1c2b24]">{partner.name}</span>
            <span className="text-xs leading-relaxed text-[#857a70]">
              Serving our diaspora community, wherever they call home.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1c2b24]">
              Quick Links
            </span>
            {["Passports & Visas", "Travel Advisories", "Consular Registration", "Community Events"].map(
              (link) => (
                <span key={link} className="cursor-default text-[#6b6156] hover:text-[#0b2e22]">
                  {link}
                </span>
              ),
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1c2b24]">
              Contact
            </span>
            <span className="text-[#6b6156]">Diplomatic Quarter, Host City</span>
            <span className="text-[#6b6156]">+1 (000) 000-0000</span>
            <span className="text-[#6b6156]">info@example.org</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1c2b24]">
              Connect
            </span>
            <div className="flex items-center gap-2">
              {["circle", "square", "triangle"].map((shape) => (
                <span
                  key={shape}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9d2c4] text-[#6b6156]"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    {shape === "circle" && <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" />}
                    {shape === "square" && <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />}
                    {shape === "triangle" && <path d="M12 6 18 18H6L12 6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />}
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-4xl flex-col gap-4 border-t border-[#d9d2c4] py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {["About", "Services", "Privacy Policy", "Contact"].map((link) => (
              <span key={link} className="cursor-default underline decoration-[#d9d2c4]">
                {link}
              </span>
            ))}
          </div>
          <p className="max-w-md text-xs text-[#857a70]">
            This page is a concept preview generated by CultureMesh to
            demonstrate an embedded network search for {partner.name}. It is
            not affiliated with or published by any government.
          </p>
        </div>
      </footer>
    </div>
  );
}
