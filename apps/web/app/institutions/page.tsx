import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your institution — CultureMesh",
  robots: { index: false, follow: false },
};

// Staff landing page. Most staff belong to exactly one institution, so
// this is usually a single link - kept as its own page rather than a
// redirect so somebody on two (an agency and an association) isn't sent
// to an arbitrary one of them.
export default async function InstitutionsPage() {
  const t = await getTranslations("institutions");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?returnTo=/institutions");

  const { data: staff } = await supabase
    .from("institution_staff")
    .select("institution_id")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  const ids = (staff ?? []).map((s) => s.institution_id as number);
  const { data: institutions } = ids.length
    ? await supabase.from("institutions").select("id, name, kind").in("id", ids)
    : { data: [] };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
        {t("title")}
      </h1>
      {(institutions ?? []).length === 0 ? (
        <p className="text-body">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(institutions ?? []).map((i) => (
            <li key={i.id} className="rounded-lg border border-border bg-surface p-4">
              <Link
                href={`/institutions/${i.id}`}
                className="font-medium text-ink underline hover:text-primary"
              >
                {i.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
