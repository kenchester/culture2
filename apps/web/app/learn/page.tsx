import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveLearnSlugForEmail } from "@/app/learn/actions";

// The bare learn.culturemesh.com root - not any one school's page. Every
// school lives at /learn/{slug} (see app/learn/[slug]/page.tsx); this is
// just the entry point that gets a visitor there. A real "choose your
// school" picker is a natural follow-up once more schools exist - for now
// the minimal list below is just enough that the root doesn't silently
// misroute as schools are added, not a designed experience.
export default async function LearnRootPage() {
  const supabase = await createClient();

  // A signed-in visitor whose verified email matches an approved school
  // should land straight on their own school's page, even though the
  // example org (Acme) is what an anonymous visitor sees here - same
  // domain-match logic the sign-in flow already uses (otp-form.tsx).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    const ownSlug = await resolveLearnSlugForEmail(user.email);
    if (ownSlug) {
      redirect(`/learn/${ownSlug}`);
    }
  }

  const { data: orgs } = await supabase.from("organizations").select("name, slug").eq("subdomain", "learn");

  if (!orgs || orgs.length === 0) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not configured.</div>;
  }

  if (orgs.length === 1) {
    redirect(`/learn/${orgs[0].slug}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="font-display text-2xl text-ink">Choose your school</h1>
      <div className="flex flex-col gap-2">
        {orgs.map((org) => (
          <Link
            key={org.slug}
            href={`/learn/${org.slug}`}
            className="rounded-lg border border-border bg-surface p-4 font-medium text-ink transition-colors hover:border-primary"
          >
            {org.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
