"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendBulkEmails } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";

export async function postProductUpdate(formData: FormData) {
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!title.trim() || !body.trim()) {
    redirect(
      `/admin/product-updates?error=${encodeURIComponent("Title and body are required.")}`,
    );
  }

  // DB-level RLS (admins-only insert) is the real enforcement boundary
  // here, same as places/languages and embed-partners - this is just the
  // path a signed-out or non-admin request would already be blocked by
  // the admin layout gate before reaching.
  const { error } = await supabase
    .from("product_updates")
    .insert({ title, body, posted_by: user.id });

  if (error) {
    redirect(`/admin/product-updates?error=${encodeURIComponent(error.message)}`);
  }

  // Best-effort - the update is already published above, so an email
  // hiccup here shouldn't turn a successful publish into an error.
  try {
    const { data: allUsers } = await supabase.from("profiles").select("id");
    const candidateIds = (allUsers ?? []).map((u) => u.id as string);
    const recipients = await getOptedInRecipients(candidateIds, "product_updates");

    if (recipients.length > 0) {
      const siteUrl = await getSiteUrl();
      await sendBulkEmails(
        recipients.map((r) => ({
          to: r.email,
          subject: `CultureMesh update: ${title}`,
          text: `${body}\n\n${siteUrl}`,
        })),
      );
    }
  } catch {
    // notification failure is non-fatal
  }

  revalidatePath("/admin/product-updates");
  redirect("/admin/product-updates?posted=1");
}
