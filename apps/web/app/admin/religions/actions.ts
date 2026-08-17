"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseAliases(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string") {
    return [];
  }
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

export async function createReligion(formData: FormData) {
  const name = formData.get("name") as string;
  const aliases = parseAliases(formData.get("aliases"));

  const supabase = await createClient();
  const { error } = await supabase.from("religions").insert({ name, aliases });

  if (error) {
    redirect(`/admin/religions?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/religions");
}

export async function updateReligion(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const aliases = parseAliases(formData.get("aliases"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("religions")
    .update({ name, aliases })
    .eq("id", Number(id));

  if (error) {
    redirect(`/admin/religions?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/religions");
}
