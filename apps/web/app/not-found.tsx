import Link from "next/link";
import { getTranslations } from "next-intl/server";

// The catch-all 404, for URLs that genuinely lead nowhere - a typo, a stale
// bookmark, a deleted network. Content that exists but the viewer isn't
// allowed to see does NOT come here: a school post renders the sign-in
// prompt instead (components/sign-in-to-view.tsx), because telling someone
// "this doesn't exist" when it does and they could reach it by signing in
// is a dead end they have no way out of.
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
      <p className="text-body">
        {t.rich("body", {
          home: (chunks) => (
            <Link href="/" className="text-primary underline">
              {chunks}
            </Link>
          ),
          contact: (chunks) => (
            <Link href="/contact" className="text-primary underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
