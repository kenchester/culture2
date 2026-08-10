import { createLanguage, createPlace, updateLanguage, updatePlace } from "./actions";
import { LanguageManager } from "./language-manager";
import { PlaceManager } from "./place-manager";

export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex w-full flex-col gap-10">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Languages</h2>
        <LanguageManager createLanguage={createLanguage} updateLanguage={updateLanguage} />
      </section>
      <section className="border-t border-border pt-8">
        <h2 className="mb-3 font-display text-xl text-ink">Geography</h2>
        <PlaceManager createPlace={createPlace} updatePlace={updatePlace} />
      </section>
    </div>
  );
}
