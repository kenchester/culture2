"use client";

import { useState } from "react";
import { launchNetworkForEmbed } from "@/app/embed/[partnerSlug]/actions";
import { Button } from "@/components/ui/button";

export function EmbedLaunchForm({
  originKind,
  originId,
  locationId,
  title,
}: {
  originKind: "language" | "place";
  originId: number;
  locationId: string;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("originKind", originKind);
    formData.set("originId", String(originId));
    formData.set("locationId", locationId);
    formData.set("title", title);

    const result = await launchNetworkForEmbed(formData);

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    if (result.redirectPath) {
      // Absolute URL: window.top's current location may be the partner's
      // own domain, so a bare relative path would resolve against that
      // domain instead of ours.
      window.top!.location.href = `${window.location.origin}${result.redirectPath}`;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <Button type="submit" disabled={pending}>
        Launch this network
      </Button>
    </form>
  );
}
