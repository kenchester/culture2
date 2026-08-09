"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { launchNetworkForEmbed } from "@/app/embed/[partnerSlug]/actions";
import { Button } from "@/components/ui/button";

export function EmbedLaunchForm({
  partnerSlug,
  originKind,
  originId,
  locationId,
  title,
}: {
  partnerSlug: string;
  originKind: "language" | "place";
  originId: number;
  locationId: string;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("partnerSlug", partnerSlug);
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
      // Navigate within the iframe itself (never window.top) so the
      // partner's page never appears to be replaced or left.
      router.push(result.redirectPath);
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
