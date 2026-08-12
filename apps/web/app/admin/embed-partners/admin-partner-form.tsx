"use client";

import { useEffect, useRef, useState } from "react";
import {
  AutocompleteField,
  optionLabel,
  type AutocompleteOption,
  type PlaceOption,
} from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

export function AdminPartnerForm({
  action,
  demoAction,
}: {
  action: (formData: FormData) => void;
  demoAction: (formData: FormData) => Promise<{ slug: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [originKind, setOriginKind] = useState<"place" | "language">("place");
  const [lockedOrigin, setLockedOrigin] = useState<AutocompleteOption | null>(null);
  const [jurisdictions, setJurisdictions] = useState<AutocompleteOption[]>([]);
  const [isOriginGlobal, setIsOriginGlobal] = useState(false);
  const [isJurisdictionGlobal, setIsJurisdictionGlobal] = useState(false);
  const [jurisdictionPlaceholder, setJurisdictionPlaceholder] = useState<string | undefined>();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  // Suggest a realistic jurisdiction example nested inside whatever origin
  // place is locked, instead of a generic "e.g. Michigan" that has nothing
  // to do with the partner being configured.
  useEffect(() => {
    const originPlace =
      originKind === "place" && lockedOrigin && "type" in lockedOrigin
        ? (lockedOrigin as PlaceOption)
        : null;

    let cancelled = false;
    const request: Promise<{ name: string } | null> = originPlace
      ? fetch(`/api/places/${originPlace.id}/example-child`).then((r) => r.json())
      : Promise.resolve(null);

    request
      .then((child) => {
        if (!cancelled) {
          setJurisdictionPlaceholder(child ? `e.g. ${child.name}` : undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setJurisdictionPlaceholder(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [originKind, lockedOrigin]);

  function openDemo(basePath: string) {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    // Open the tab synchronously, in the click handler itself, so browsers
    // don't treat it as a blocked popup - then point it at the demo once
    // the partner is actually created.
    const demoWindow = window.open("about:blank", "_blank");
    setIsCreatingDemo(true);
    demoAction(formData)
      .then(({ slug }) => {
        if (demoWindow) {
          demoWindow.location.href = `${basePath}/${slug}`;
        }
      })
      .finally(() => setIsCreatingDemo(false));
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="originKind" value={originKind} />
      <input
        type="hidden"
        name="jurisdictionPlaceIds"
        value={JSON.stringify(jurisdictions.map((j) => j.id))}
      />
      <Field>
        <Label htmlFor="partner-name">Partner name</Label>
        <Input
          id="partner-name"
          name="name"
          placeholder="e.g. Embassy of Indonesia"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="partner-slug">URL slug</Label>
        <Input id="partner-slug" name="slug" placeholder="e.g. indonesia" required />
      </Field>

      <label className="flex items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          name="originIsGlobal"
          checked={isOriginGlobal}
          onChange={(e) => setIsOriginGlobal(e.target.checked)}
        />
        Global (no origin restriction &mdash; visitor picks their own origin)
      </label>

      {!isOriginGlobal && (
        <>
          <div className="flex gap-4 text-sm text-body">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={originKind === "language"}
                onChange={() => {
                  setOriginKind("language");
                  setLockedOrigin(null);
                }}
              />
              Locked language
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={originKind === "place"}
                onChange={() => {
                  setOriginKind("place");
                  setLockedOrigin(null);
                }}
              />
              Locked origin place
            </label>
          </div>
          <AutocompleteField
            key={originKind}
            label="Locked origin"
            kind={originKind}
            hiddenName="originId"
            onSelect={setLockedOrigin}
          />
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          name="jurisdictionIsGlobal"
          checked={isJurisdictionGlobal}
          onChange={(e) => setIsJurisdictionGlobal(e.target.checked)}
        />
        Global (no jurisdiction restriction &mdash; any location worldwide)
      </label>

      {!isJurisdictionGlobal && (
        <>
          <AutocompleteField
            key={jurisdictions.length}
            label="Add a jurisdiction place"
            kind="place"
            placeholder={jurisdictionPlaceholder}
            onSelect={(option) => {
              if (option && !jurisdictions.some((j) => j.id === option.id)) {
                setJurisdictions((prev) => [...prev, option]);
              }
            }}
          />
          {jurisdictions.length > 0 && (
            <ul className="flex flex-col gap-1">
              {jurisdictions.map((j) => (
                <li
                  key={j.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
                >
                  {optionLabel(j)}
                  <button
                    type="button"
                    onClick={() =>
                      setJurisdictions((prev) => prev.filter((x) => x.id !== j.id))
                    }
                    className="text-error underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-body">
        <input type="checkbox" name="hideOriginLabel" defaultChecked />
        Hide origin label (white-label)
      </label>

      <div className="flex gap-3">
        <Button type="submit" className="self-start">
          Create partner
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={isCreatingDemo}
          onClick={() => openDemo("/embed-partners/demo")}
        >
          {isCreatingDemo ? "Creating…" : "Embassy Demo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={isCreatingDemo}
          onClick={() => openDemo("/embed-partners/travel-demo")}
        >
          {isCreatingDemo ? "Creating…" : "Travel Demo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={isCreatingDemo}
          onClick={() => openDemo("/embed-partners/remittance-demo")}
        >
          {isCreatingDemo ? "Creating…" : "Remittance Demo"}
        </Button>
      </div>
    </form>
  );
}
