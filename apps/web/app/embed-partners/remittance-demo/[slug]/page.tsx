import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const navLinks = ["Send Money", "Track Transfer", "Rates", "Business", "Help"];

const trustPoints = [
  "Bank-beating exchange rates",
  "Decades of currency expertise",
  "Most transfers arrive in minutes",
];

const valueProps = [
  { label: "Great rates, every time" },
  { label: "Fast, tracked delivery" },
  { label: "Send to 200+ countries" },
  { label: "Trusted by millions" },
];

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-[#5b6472]">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe3ea] bg-white text-[#0a6e4d]">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path d="M12 4v16m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// A generic remittance/money-transfer preset, styled after the layout
// common to send-money sites like xe.com (headline + trust points on the
// left, a send-money calculator widget on the right) - not a copy of any
// specific brand's name, logo, or copy, same "reusable concept preview"
// approach as the other two presets. The mocked calculator on the right is
// purely decorative; the real embed sits on the left, where the headline
// usually leads straight into a CTA/app-download block.
export default async function EmbedPartnerRemittanceDemoPage({
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
    <div className="flex min-h-full flex-col bg-white font-sans text-[#0f1f18]">
      {/* Preview disclosure bar - same honest-labeling convention as the
          other demo presets. */}
      <div className="flex items-center justify-center gap-2 bg-[#eaf6f0] px-4 py-2 text-center text-xs text-[#0f1f18]">
        <span>
          CultureMesh embed concept preview, built for {partner.name} &mdash;
          not an official money transfer service.
        </span>
        <Link href="/" className="font-medium underline">
          About CultureMesh
        </Link>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#e3e8e4] px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a6e4d] text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M7 15V6m0 0L4 9m3-3 3 3M17 9v9m0 0 3-3m-3 3-3-3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-lg font-semibold text-[#0f1f18]">{partner.name}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#4c5a53] sm:flex">
          {navLinks.map((link) => (
            <span key={link} className="cursor-default hover:text-[#0a6e4d]">
              {link}
            </span>
          ))}
        </nav>
        <span className="rounded-md bg-[#0a6e4d] px-4 py-2 text-sm font-medium text-white">
          Sign in
        </span>
      </header>

      {/* Hero: headline + real embed on the left, mocked calculator on the right */}
      <section className="px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-2">
          {/* Left: headline and the actual embed, exactly as a partner
              would receive it */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-bold leading-tight text-[#0f1f18] sm:text-5xl">
                Seamless and Secure International Money Transfers
              </h1>
              <p className="max-w-md text-[#4c5a53]">
                Sending money home? Find your community there too, wherever
                your transfer lands.
              </p>
              <ul className="flex flex-col gap-2">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-[#3a463f]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#0a6e4d]">
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#e3e8e4] bg-white shadow-lg">
              <iframe
                src={embedUrl}
                style={{ width: "100%", height: 640, border: "none", display: "block" }}
                title="CultureMesh"
              />
            </div>
          </div>

          {/* Right: purely decorative - mocked to read as a typical
              send-money calculator at a glance, not a working form. */}
          <div className="flex flex-col gap-4 rounded-xl border border-[#e3e8e4] bg-[#f7faf8] p-6 shadow-md">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[#5b6472]">
                You send
              </span>
              <div className="flex items-center justify-between rounded-md border border-[#dfe3ea] bg-white px-3 py-2.5">
                <span className="text-lg font-semibold text-[#0f1f18]">1,000.00</span>
                <span className="flex items-center gap-1 text-sm font-medium text-[#0f1f18]">
                  USD
                  <ChevronIcon />
                </span>
              </div>
            </div>

            <div className="-my-1 flex justify-center">
              <ArrowDownIcon />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[#5b6472]">
                Recipient gets
              </span>
              <div className="flex items-center justify-between rounded-md border border-[#dfe3ea] bg-white px-3 py-2.5">
                <span className="text-lg font-semibold text-[#0f1f18]">918.42</span>
                <span className="flex items-center gap-1 text-sm font-medium text-[#0f1f18]">
                  EUR
                  <ChevronIcon />
                </span>
              </div>
            </div>

            <p className="text-xs text-[#5b6472]">1 USD = 0.9184 EUR &middot; no hidden fees</p>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[#5b6472]">
                Payment method
              </span>
              <div className="flex gap-2 text-sm">
                {["Bank transfer", "Card", "Wallet"].map((method, index) => (
                  <span
                    key={method}
                    className={`rounded-md border px-3 py-1.5 ${
                      index === 0
                        ? "border-[#0a6e4d] bg-[#eaf6f0] text-[#0a6e4d]"
                        : "border-[#dfe3ea] text-[#4c5a53]"
                    }`}
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            <span className="mt-2 cursor-default rounded-md bg-[#0a6e4d] px-4 py-3 text-center text-sm font-semibold text-white">
              Start my transfer
            </span>
          </div>
        </div>
      </section>

      {/* Value props, matching the icon-row pattern common to fintech sites */}
      <section className="border-t border-[#e3e8e4] px-6 py-14 sm:px-10">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {valueProps.map((prop) => (
            <div
              key={prop.label}
              className="flex flex-col items-center gap-3 rounded-lg border border-[#e3e8e4] p-5 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf6f0] text-[#0a6e4d]">
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
              <span className="text-sm font-medium text-[#0f1f18]">{prop.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#e3e8e4] bg-[#f7faf8] px-6 py-10 text-sm text-[#4c5a53] sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 border-b border-[#e3e8e4] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a6e4d] text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <span className="text-[#0f1f18]">{partner.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {["About", "Rates", "Privacy Policy", "Help"].map((link) => (
              <span key={link} className="cursor-default underline decoration-[#e3e8e4]">
                {link}
              </span>
            ))}
          </div>
        </div>
        <p className="mx-auto max-w-3xl pt-4 text-xs text-[#7a8781]">
          This page is a concept preview generated by CultureMesh to
          demonstrate an embedded network search for {partner.name}. It is
          not affiliated with or published by any money transfer company.
        </p>
      </footer>
    </div>
  );
}
