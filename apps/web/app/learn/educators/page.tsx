import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LiveDemoPicker } from "@/app/learn/educators/live-demo-picker";

// Matches Button's own primary-variant class composition (components/ui/
// button.tsx) at a larger size - Button itself renders a literal <button>
// with no polymorphic "render as a different element" support, so a link
// styled to look like it is built the same way nav.tsx's own sign-up link
// already is, rather than nesting an <a> inside a <button>.
const ctaClassName =
  "inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-base font-medium text-white transition-colors hover:bg-primary-hover";

type DemoNetworkRow = {
  language: { name: string } | null;
  network: { id: number; member_count: number; post_count: number } | null;
};

// A sales/outreach page for language teachers, program coordinators, and
// department admins - not a page any student or recognized school member
// ever lands on, so it deliberately lives outside the /learn/[slug]
// dynamic route (a literal segment always wins routing precedence over a
// sibling [slug] route, so this coexists with it with no proxy.ts changes)
// and outside the campus-network canonicalization that route enforces -
// this is general marketing for the Learn product line, not any one
// school's page, so it stays on the plain host rather than redirecting to
// learn.culturemesh.com.
//
// English-only for this first version, unlike the rest of the app's next-
// intl-driven pages - this is outbound sales copy aimed first at US higher-
// ed contacts, and the translation surface here (a full landing page) is
// large enough that machine-translating it into 10 languages sight-unseen
// risked shipping copy nobody had actually reviewed. Worth revisiting once
// there's real demand from non-English-speaking programs.
const FEATURES = [
  {
    title: "Only the target language gets through",
    body: "Every network enforces its own language. A post or reply that isn't written in the target language gets filtered and blocked automatically - so it stays real practice, not a group chat that drifts back to English by the second week.",
  },
  {
    title: "Speaking and signing practice, not just typing",
    body: "Students can post up to 60 seconds of audio or video instead of text - real pronunciation practice, not just reading comprehension. For programs with no written form at all - American Sign Language chief among them - video isn't an add-on here, it's the only way a student can post in the first place.",
  },
  {
    title: "Any language, from day one",
    body: "A recognized member can launch a new language network themselves the moment they need one - no waiting on a vendor contract or an IT ticket to support a smaller or less commonly taught language.",
  },
  {
    title: "A weekly prompt, built in",
    body: "Instructors can set a prompt for their network each week - \"describe your weekend,\" \"explain a recipe,\" whatever fits the unit - without building assignment infrastructure of your own.",
  },
  {
    title: "Real speakers, not just classmates",
    body: "When a closed class cohort isn't enough, students can search the wider public CultureMesh network and reach real native and heritage speakers around the world - the actual immersion promise, made concrete.",
  },
  {
    title: "Set up in minutes, not a semester",
    body: "Students signing in with your school's email domain are recognized automatically - no separate accounts, no roster upload, no new login for anyone to remember.",
  },
];

const FAQ = [
  {
    q: "What does it cost?",
    a: "Nothing. There's no paid tier to unlock, seat limit, or trial period.",
  },
  {
    q: "How long does setup actually take?",
    a: "For most schools, minutes: once your domain is on file, students are recognized automatically the moment they sign in. If a language your program teaches doesn't have a network yet, any recognized member can start one on the spot.",
  },
  {
    q: "Is it moderated?",
    a: "Every post and reply has a report control, and school-gated networks are only visible to members you or your program recognize - not open to the public internet.",
  },
  {
    q: "Do students need a new account?",
    a: "No. Someone already signed in under a personal account can add their school email and get recognized without creating a second identity or losing anything.",
  },
];

export default async function EducatorsPage() {
  const supabase = await createClient();
  const { data: demoLanguages } = await supabase
    .from("organization_languages")
    .select("language:languages(name), network:networks(id, member_count, post_count)")
    .eq("organization_id", 1);

  const demoRows = (demoLanguages ?? []) as unknown as DemoNetworkRow[];
  const demoNetworks = demoRows
    .filter((row) => row.language && row.network)
    .map((row) => ({
      id: row.network!.id,
      language: row.language!.name,
      memberCount: row.network!.member_count,
      postCount: row.network!.post_count,
    }));

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">CultureMesh Learn</p>
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
            Your students get three hours a week of class time. What happens the other 165?
          </h1>
          <p className="text-lg text-body">
            CultureMesh Learn gives every student in your program a place to keep practicing - in the
            language they&apos;re learning, with people who&apos;ll actually respond - long after class
            ends.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/learn/start" className={ctaClassName}>
              Request CultureMesh Learn for your program
            </Link>
          </div>
        </div>
      </div>

      {/* The gap */}
      <div className="mx-auto w-full max-w-3xl px-4 py-14">
        <h2 className="font-display text-2xl text-ink">The practice gap</h2>
        <p className="mt-3 text-body">
          Most language apps optimize for solo drilling - flashcards, matching games, spaced
          repetition. That helps early on, but past the beginner stage the actual bottleneck is
          production: saying or signing something to another person and being understood. Class time
          covers a few hours of that a week. Everything else is up to the student to find on their
          own, and most don&apos;t.
        </p>
        <p className="mt-3 text-body">
          CultureMesh Learn is a school-gated practice space built around that specific gap - not a
          general chat app repurposed for class, and not another solo drilling app.
        </p>
        {demoNetworks.length > 0 && (
          <>
            <p className="mt-6 text-body">
              Don&apos;t take our word for it - Acme University is a real, working example on
              CultureMesh. Click a network below to see it live.
            </p>
            <LiveDemoPicker networks={demoNetworks} />
          </>
        )}
      </div>

      {/* Feature walkthrough */}
      <div className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-14">
          <h2 className="font-display text-2xl text-ink">How it closes the gap</h2>
          <div className="mt-8 flex flex-col gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <h3 className="font-display text-lg text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-body">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-14">
          <h2 className="font-display text-2xl text-ink">Questions programs usually ask</h2>
          <div className="mt-8 flex flex-col gap-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-medium text-ink">{item.q}</h3>
                <p className="mt-1 text-body">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-16">
        <h2 className="font-display text-2xl text-ink">Bring it to your program</h2>
        <p className="text-body">
          Tell us about your program and we&apos;ll get your school set up - most requests are live
          within a few days.
        </p>
        <Link href="/learn/start" className={ctaClassName}>
          Request CultureMesh Learn for your program
        </Link>
      </div>
    </div>
  );
}
