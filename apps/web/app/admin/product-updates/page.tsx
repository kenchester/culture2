import { createClient } from "@/lib/supabase/server";
import { UpdateForm } from "@/app/admin/product-updates/update-form";
import { FormError, FormSuccess } from "@/components/ui/form-error";

type ProductUpdateRow = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

export default async function AdminProductUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; posted?: string; sentCount?: string }>;
}) {
  const { error, posted, sentCount } = await searchParams;
  const supabase = await createClient();

  const { data: updates } = (await supabase
    .from("product_updates")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })) as unknown as { data: ProductUpdateRow[] | null };

  return (
    <div className="flex w-full flex-col gap-8">
      {error && (
        <FormError>{error}</FormError>
      )}
      {posted && (
        <FormSuccess>
          {sentCount
            ? `Sent to ${sentCount} recipient${sentCount === "1" ? "" : "s"}.`
            : "Published, and emailed to everyone opted into product updates."}
        </FormSuccess>
      )}

      <UpdateForm />

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        {updates?.map((update) => (
          <div key={update.id} className="flex flex-col gap-1 border-b border-border pb-4">
            <p className="font-medium text-ink">{update.title}</p>
            <p className="text-xs text-muted">
              {new Date(update.created_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-body">{update.body}</p>
          </div>
        ))}
        {updates?.length === 0 && <p className="text-sm text-muted">No updates posted yet.</p>}
      </div>
    </div>
  );
}
