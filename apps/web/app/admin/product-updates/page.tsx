import { createClient } from "@/lib/supabase/server";
import { postProductUpdate } from "@/app/admin/product-updates/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";

type ProductUpdateRow = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

export default async function AdminProductUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; posted?: string }>;
}) {
  const { error, posted } = await searchParams;
  const supabase = await createClient();

  const { data: updates } = (await supabase
    .from("product_updates")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })) as unknown as { data: ProductUpdateRow[] | null };

  return (
    <div className="flex w-full flex-col gap-8">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      {posted && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          Published, and emailed to everyone opted into product updates.
        </p>
      )}

      <form action={postProductUpdate} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="update-title">Title</Label>
          <Input id="update-title" name="title" placeholder="e.g. New: reply notifications" required />
        </Field>
        <Field>
          <Label htmlFor="update-body">Body</Label>
          <Textarea
            id="update-body"
            name="body"
            placeholder="What's new..."
            required
          />
        </Field>
        <Button type="submit" className="self-start">
          Publish Update
        </Button>
      </form>

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
