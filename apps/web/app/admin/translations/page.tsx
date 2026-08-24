import { saveTranslations } from "./actions";
import { TranslationsManager } from "./translations-manager";

export default async function AdminTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <div className="flex w-full flex-col gap-6">
      <p className="text-sm text-body">
        Search for a language or place to review and edit its name in every interface language.
        Countries and languages usually already have a standard translation; anything else is
        translated automatically on first view and cached here.
      </p>
      {success && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{success}</p>
      )}
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      <TranslationsManager saveTranslations={saveTranslations} />
    </div>
  );
}
