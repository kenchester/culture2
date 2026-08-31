import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

type ClaimRow = { organization: { slug: string; name: string; is_example: boolean } | null };

// Reachable from the nav's "Schools" item (app/nav.tsx), shown only to
// someone recognized at a real (non-example) school - a manual switcher
// for that "choose your school" moment, not something learn.culturemesh.com's
// bare root ever surfaces on its own anymore (app/learn/page.tsx now always
// resolves straight to a specific school, most-recently-visited-first).
// Site-wide (not under /learn) so it works the same regardless of which
// host you're currently browsing from - see RESERVED_LEARN_SLUGS
// (lib/supabase/proxy.ts) for why that matters on the learn host
// specifically. Deliberately excludes the example org (Acme): it's a
// demo nobody is ever really "in", not a second school to switch to.
export default async function SchoolsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: claims } = await supabase
    .from("organization_whitelist")
    .select("organization:organizations(slug, name, is_example)")
    .eq("claimed_by", user.id);

  const schools = ((claims ?? []) as unknown as ClaimRow[])
    .filter((c) => c.organization && !c.organization.is_example)
    .map((c) => c.organization!)
    .sort((a, b) => a.name.localeCompare(b.name));

  const t = await getTranslations("schools");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="font-display text-2xl text-ink">{t("heading")}</h1>
      <div className="flex flex-col gap-2">
        {schools.map((org) => (
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
