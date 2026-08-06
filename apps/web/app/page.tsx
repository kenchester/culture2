import Link from "next/link";
import { SearchForm } from "@/app/search/search-form";

const steps = [
  {
    title: "Search",
    body: "Enter a language or place of origin, and where you live now.",
  },
  {
    title: "Join or launch",
    body: "Join an existing network, or be the first to launch one for your combination.",
  },
  {
    title: "Connect",
    body: "Meet people, share posts, and host or attend events together.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-20 text-center sm:py-28">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
              Find your diaspora network
            </h1>
            <p className="mx-auto max-w-xl text-lg text-body">
              CultureMesh connects people by where they&apos;re from and
              where they live now — search a language or place of origin
              and a location to find your network, or launch a new one if
              it doesn&apos;t exist yet.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 text-left shadow-sm">
            <SearchForm />
          </div>

          <Link href="/suggest-network" className="text-sm text-muted underline hover:text-primary">
            Can&apos;t find what you&apos;re looking for? Suggest a network.
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <div className="grid gap-10 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="flex flex-col gap-2">
              <span className="font-display text-3xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
              <p className="text-sm text-body">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
