"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EmbedCode({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs text-body">
        {snippet}
      </pre>
      <Button type="button" variant="secondary" className="self-start" onClick={handleCopy}>
        {copied ? "Copied" : "Copy embed code"}
      </Button>
    </div>
  );
}
