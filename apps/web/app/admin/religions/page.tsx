import { createClient } from "@/lib/supabase/server";
import { createReligion, updateReligion } from "@/app/admin/religions/actions";
import { ReligionManager } from "@/app/admin/religions/religion-manager";

export default async function AdminReligionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: religions } = await supabase
    .from("religions")
    .select("id, name, aliases")
    .order("name");

  return (
    <div className="flex w-full flex-col gap-6">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <ReligionManager
        religions={religions ?? []}
        createReligion={createReligion}
        updateReligion={updateReligion}
      />
    </div>
  );
}
