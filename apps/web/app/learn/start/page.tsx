import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/profiles";
import { submitOrganizationRequest } from "@/app/learn/start/actions";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

// Free, self-serve path to a single class/language at a school - the
// "sell a whole language department" flow stays the manual admin form
// (app/admin/organizations). Requires sign-in first (not an anonymous
// form): proves the requester actually controls their institutional email
// before it's ever shown to a reviewer, and lets approval grant admin
// access directly with no separate invite-token round trip
// (see app/admin/organizations/actions.ts's approveOrganizationRequest).
export default async function StartClassPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-body">
        <Link
          href={`/sign-in?returnTo=${encodeURIComponent("/learn/start")}`}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>{" "}
        with your institutional email to request a class.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, username")
    .eq("id", user.id)
    .single();

  if (sent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-body">
        <h1 className="mb-2 font-display text-2xl text-ink">Request sent</h1>
        <p>
          Thanks - we&apos;ll review your request and follow up at {user.email} once it&apos;s
          approved.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-2xl text-ink">Start a free class on CultureMesh Learn</h1>
        <p className="mt-2 text-body">
          Get one language network for your class, free - a good way to try CultureMesh Learn
          before bringing in a whole department. We&apos;ll review your request and follow up at{" "}
          {user.email}.
        </p>
      </div>

      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}

      <form action={submitOrganizationRequest} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <Field>
          <Label htmlFor="instructorName">Your name</Label>
          <Input
            id="instructorName"
            name="instructorName"
            defaultValue={profile ? getDisplayName(profile) : ""}
            required
          />
        </Field>
        <Field>
          <Label htmlFor="profileUrl">Faculty profile or LinkedIn URL</Label>
          <Input
            id="profileUrl"
            name="profileUrl"
            type="url"
            placeholder="https://"
            required
          />
        </Field>
        <Field>
          <Label htmlFor="schoolName">School name</Label>
          <Input id="schoolName" name="schoolName" placeholder="e.g. Springfield University" required />
        </Field>
        <AutocompleteField label="Language you teach" kind="language" hiddenName="languageId" />
        <Field>
          <Label htmlFor="locationName">School location</Label>
          <Input id="locationName" name="locationName" placeholder="e.g. Springfield, Illinois" required />
        </Field>
        <AutocompleteField
          label="Parent geography"
          kind="place"
          placeType={["country", "region"]}
          hiddenName="parentCountryId"
        />
        <Button type="submit" className="self-start">
          Submit for approval
        </Button>
      </form>
    </div>
  );
}
