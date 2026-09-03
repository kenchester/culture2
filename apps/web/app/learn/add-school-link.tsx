"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { requestAddSchoolCode } from "@/app/learn/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

// A quiet escape hatch, not a second GetStartedBanner/DomainCheckBanner -
// only rendered on a real (non-example) school's page, for someone who
// belongs to more than one (app/learn/[slug]/page.tsx). A client
// component (not <details>) specifically so opening and closing are two
// separate, explicit actions - clicking the "Add a school network" link
// only ever opens the box, and a dedicated x closes it, rather than the
// same click target doing both (confusing: it read as if it might open a
// second box instead of dismissing the one already open). Starts open
// when there's a result to show (noMatchDomain/error, i.e. this render
// followed a form submission) so that result is never hidden inside a
// collapsed box the visitor has to know to re-open.
export function AddSchoolLink({
  slug,
  noMatchDomain,
  error,
}: {
  slug: string;
  noMatchDomain?: string;
  error?: string;
}) {
  const t = useTranslations("learn");
  const [open, setOpen] = useState(Boolean(noMatchDomain || error));

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("addSchoolLink")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="relative flex w-full max-w-sm flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("addSchoolClose")}
          className="absolute right-3 top-3 text-muted hover:text-ink"
        >
          ✕
        </button>
        <p className="pr-6 text-sm text-muted">{t("addSchoolSubheading")}</p>
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
          <SubmitButton>{t("addSchoolSubmit")}</SubmitButton>
        </form>
        {noMatchDomain && (
          <div className="flex flex-col gap-2 rounded-md bg-success-bg px-3 py-2 text-sm text-body">
            <p>{t("addSchoolNoMatch", { domain: noMatchDomain })}</p>
            {/* /learn/start requires signing in with an institutional email
                first - too much friction here. Routes to the contact form
                instead (no sign-in needed - its subject picker shows a
                required "your institution" field for this exact subject,
                see app/(marketing)/contact/subject-field.tsx). */}
            <Link
              href={`/contact?subject=${encodeURIComponent("CultureMesh Learn Interest")}&message=${encodeURIComponent(
                `I'd like to bring CultureMesh Learn to ${noMatchDomain}.`,
              )}`}
              className="self-start font-medium text-primary hover:underline"
            >
              {t("bannerRequestButton")}
            </Link>
          </div>
        )}
        {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
