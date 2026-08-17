"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createLanguage(formData: FormData) {
  const name = formData.get("name") as string;

  const supabase = await createClient();
  const { error } = await supabase.from("languages").insert({ name });

  if (error) {
    redirect(`/admin/places?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/places");
  redirect(`/admin/places?success=${encodeURIComponent(`"${name}" added.`)}`);
}

export async function updateLanguage(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;

  const supabase = await createClient();
  const { error } = await supabase.from("languages").update({ name }).eq("id", Number(id));

  if (error) {
    redirect(`/admin/places?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/places");
  redirect(`/admin/places?success=${encodeURIComponent(`"${name}" updated.`)}`);
}

// A region always needs a country parent. A city needs a parent too, but
// it may be either a state/province or - for places without that layer of
// government - a country directly, matching what the database trigger
// itself allows.
function validateParent(type: string, parentId: number | null) {
  if (type === "region" && !parentId) {
    return "A state/province needs a country.";
  }
  if (type === "city" && !parentId) {
    return "A city needs a state/province or a country.";
  }
  return null;
}

export async function createPlace(formData: FormData) {
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const parentIdRaw = formData.get("parentId") as string;
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  const validationError = validateParent(type, parentId);
  if (validationError) {
    redirect(`/admin/places?error=${encodeURIComponent(validationError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("places").insert({
    name,
    type,
    parent_id: type === "country" ? null : parentId,
  });

  if (error) {
    redirect(`/admin/places?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/places");
  redirect(`/admin/places?success=${encodeURIComponent(`"${name}" added.`)}`);
}

export async function updatePlace(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const parentIdRaw = formData.get("parentId") as string;
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  const validationError = validateParent(type, parentId);
  if (validationError) {
    redirect(`/admin/places?error=${encodeURIComponent(validationError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("places")
    .update({ name, parent_id: type === "country" ? null : parentId })
    .eq("id", Number(id));

  if (error) {
    redirect(`/admin/places?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/places");
  redirect(`/admin/places?success=${encodeURIComponent(`"${name}" updated.`)}`);
}
