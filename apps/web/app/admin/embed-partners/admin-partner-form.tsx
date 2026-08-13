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
  const [joinHeadingStyle, setJoinHeadingStyle] = useState<
    "partner_name" | "diaspora_network" | "custom_group"
  >("partner_name");

  // The regions-only jurisdiction lock only makes sense (and only produces
  // any results) when the jurisdiction is a single country - a region has
  // no region-level children, so applying the lock to anything else would
  // silently zero out every location search result.
  const soleJurisdiction =
    jurisdictions.length === 1 && "type" in jurisdictions[0] ? jurisdictions[0] : null;
  const canLockToRegions = soleJurisdiction?.type === "country";

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
    // These buttons are type="button", not type="submit" - clicking one
    // never fires the form's native submit event, so browser-enforced
    // required-field validation (and its "please fill out this field"
    // bubble) never runs on its own. reportValidity() triggers that same
    // check manually; without it, a blank required field like the URL
    // slug silently becomes an empty string, and everything downstream
    // (the insert, the demo URL, the embed code) breaks quietly instead
    // of stopping here.
    if (!formRef.current.reportValidity()) return;
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
          <label
            className={`flex items-center gap-2 text-sm ${canLockToRegions ? "text-body" : "text-muted"}`}
          >
            <input
              type="checkbox"
              name="jurisdictionRegionsOnly"
              disabled={!canLockToRegions}
              defaultChecked={false}
            />
            Lock jurisdiction to only regions and not cities (only works if
            choosing a country-level jurisdiction)
          </label>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-body">
        <input type="checkbox" name="hideOriginLabel" defaultChecked />
        Hide origin label (white-label)
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Join heading</span>
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="radio"
            name="joinHeadingStyle"
            value="partner_name"
            checked={joinHeadingStyle === "partner_name"}
            onChange={() => setJoinHeadingStyle("partner_name")}
          />
          &ldquo;Join the local network of [Partner Name]&rdquo;
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="radio"
            name="joinHeadingStyle"
            value="diaspora_network"
            checked={joinHeadingStyle === "diaspora_network"}
            onChange={() => setJoinHeadingStyle("diaspora_network")}
          />
          &ldquo;Join our diaspora network&rdquo;
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="radio"
            name="joinHeadingStyle"
            value="custom_group"
            checked={joinHeadingStyle === "custom_group"}
            onChange={() => setJoinHeadingStyle("custom_group")}
          />
          &ldquo;Join a local ___ network&rdquo;
        </label>
        {joinHeadingStyle === "custom_group" && (
          <div className="mt-1 max-w-xs">
            <Field>
              <Label htmlFor="join-heading-group-name">
                What does this group call itself? (e.g. &ldquo;Saudis&rdquo;, not
                &ldquo;Saudi Arabians&rdquo;)
              </Label>
              <Input
                id="join-heading-group-name"
                name="joinHeadingGroupName"
                placeholder="e.g. Saudis"
                required
              />
            </Field>
          </div>
        )}
      </div>

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
