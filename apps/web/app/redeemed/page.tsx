import { createClient } from "@/lib/supabase/server";
import { RedeemedSearchForm } from "@/app/redeemed/redeemed-search-form";

// "Christian" is looked up by name rather than a hardcoded id, so this
// keeps working even if the religions table ever gets reseeded with
// different ids.
export default async function RedeemedPage() {
  const supabase = await createClient();
  const { data: religion } = await supabase
    .from("religions")
    .select("id")
    .eq("name", "Christian")
    .single();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl text-ink">
          Find Christian community anywhere in the world
        </h1>
        {religion ? (
          <RedeemedSearchForm religionId={religion.id} />
        ) : (
          <p className="text-sm text-error">
            Something&rsquo;s misconfigured here - please check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
