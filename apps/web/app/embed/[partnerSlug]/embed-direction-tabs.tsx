import Link from "next/link";

/**
 * The flip between a place's two diaspora questions.
 *
 * Links rather than buttons, and a server component rather than a client
 * one, for the same reason the corridor questions use <details>: this has
 * to work inside an iframe on somebody else's page with no guarantee that
 * our JavaScript ran. Each tab is a URL, so it is shareable, back-button
 * correct, and crawlable.
 *
 * Switching direction deliberately drops every other search parameter. A
 * half-finished answer to "where do you live now?" is not an answer to
 * "where are you from?" - carrying it across would silently reinterpret
 * what the visitor said as a reply to a question they were never asked.
 */
export function EmbedDirectionTabs({
  partnerSlug,
  homeName,
  active,
}: {
  partnerSlug: string;
  homeName: string;
  active: "out" | "in";
}) {
  const tabs = [
    { key: "out" as const, label: `${homeName} people elsewhere` },
    { key: "in" as const, label: `People in ${homeName}` },
  ];

  return (
    <nav
      // Labelled, because two links whose text differs only in word order
      // are indistinguishable to a screen reader without it.
      aria-label="Which direction"
      className="inline-flex w-fit rounded-md border border-border bg-surface p-1 text-sm"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`/embed/${partnerSlug}?dir=${tab.key}`}
          aria-current={active === tab.key ? "page" : undefined}
          className={`rounded px-3 py-1.5 transition-colors ${
            active === tab.key
              ? "bg-primary text-white"
              : "text-body hover:text-primary"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
