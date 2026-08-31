import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requestAddSchoolCode } from "@/app/learn/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// A quiet escape hatch, not a second GetStartedBanner/DomainCheckBanner -
// only rendered on a real (non-example) school's page, for someone who
// belongs to more than one (app/learn/[slug]/page.tsx). <details> gives
// the "clickable link that reveals a form" interaction with no client
// component needed; collapsed by default so it doesn't compete with the
// page's actual content above it.
export async function AddSchoolLink({
  slug,
  noMatchDomain,
  error,
}: {
  slug: string;
  noMatchDomain?: string;
  error?: string;
}) {
  const t = await getTranslations("learn");

  return (
    <details className="flex flex-col items-end gap-2 text-right">
      <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
        {t("addSchoolLink")}
      </summary>
      <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left">
        <p className="text-sm text-muted">{t("addSchoolSubheading")}</p>
        <form action={requestAddSchoolCode} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="backToSlug" value={slug} />
          <Input
            type="email"
            name="email"
            placeholder={t("addSchoolPlaceholder")}
            className="flex-1"
            aria-label={t("addSchoolLink")}
            required
          />
          <Button type="submit">{t("addSchoolSubmit")}</Button>
        </form>
        {noMatchDomain && (
          <div className="flex flex-col gap-2 rounded-md bg-success-bg px-3 py-2 text-sm text-body">
            <p>{t("addSchoolNoMatch", { domain: noMatchDomain })}</p>
            <Link href="/learn/start" className="self-start font-medium text-primary hover:underline">
              {t("bannerRequestButton")}
            </Link>
          </div>
        )}
        {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      </div>
    </details>
  );
}
