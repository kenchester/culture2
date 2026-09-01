"use client";

import { useState } from "react";

export type DemoNetwork = {
  id: number;
  language: string;
  memberCount: number;
  postCount: number;
};

// Clicking a language box swaps which network's iframe is shown below it,
// rather than linking away to it - a coordinator can compare two networks
// in a few clicks without losing their place on the page. The iframe
// itself is the real network page (?embed=1 - the same param this app's
// partner embeds already use to render chrome-free), not a mockup: it's
// publicly readable content, so an anonymous visitor sees exactly what a
// student would. key={active.id} on the iframe forces a fresh mount on
// every switch instead of trying to navigate the existing one in place.
export function LiveDemoPicker({ networks }: { networks: DemoNetwork[] }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = networks.find((n) => n.id === activeId) ?? null;

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {networks.map((network) => (
          <button
            key={network.id}
            type="button"
            onClick={() => setActiveId(network.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              activeId === network.id
                ? "border-primary bg-primary-light"
                : "border-border bg-surface hover:border-primary"
            }`}
          >
            <p className="font-medium text-ink">{network.language}</p>
            <p className="mt-1 text-sm text-muted">
              {network.memberCount} members, {network.postCount} posts
            </p>
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="text-sm font-medium text-ink">{active.language} at Acme University - live</p>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label="Close demo"
              className="text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
          <iframe
            key={active.id}
            src={`https://learn.culturemesh.com/networks/${active.id}?embed=1`}
            title={`${active.language} network demo`}
            className="h-[600px] w-full"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
