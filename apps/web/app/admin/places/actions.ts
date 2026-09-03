"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


// ISO 639-1 is the two-letter standard ("es", "zh"), and it's what both
// Whisper's language parameter and HTML's lang attribute expect - so a
// typo'd or wrong-standard value (three-letter ISO 639-3, or an uppercase
// country code) is worse than none at all: it would be passed straight to
// the transcriber and to screen readers. Blank stays blank; many regional,
// indigenous and sign languages have no ISO 639-1 code and are meant to
// have none here.
function parseIsoCode(raw: string): { value: string | null; error?: string } {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed) {
    return { value: null };
  }
  if (!/^[a-z]{2}$/.test(trimmed)) {
    return {
      value: null,
      error: `"${raw.trim()}" isn't a valid ISO 639-1 code - it must be exactly two letters, like "es" or "zh". Leave it blank if this language doesn't have one.`,
    };
  }
  return { value: trimmed };
}

export async function createLanguage(formData: FormData) {
  const name = formData.get("name") as string;
  const iso = parseIsoCode(formData.get("isoCode") as string);
  if (iso.error) {
    redirect(`/admin/places?error=${encodeURIComponent(iso.error)}`);
  }
  const isSigned = formData.get("isSigned") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("languages")
    .insert({ name, iso_code: iso.value, is_signed: isSigned });

  if (error) {
    redirect(`/admin/places?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/places");
  redirect(`/admin/places?success=${encodeURIComponent(`"${name}" added.`)}`);
}

export async function updateLanguage(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const iso = parseIsoCode(formData.get("isoCode") as string);
  if (iso.error) {
    redirect(`/admin/places?error=${encodeURIComponent(iso.error)}`);
  }
  const isSigned = formData.get("isSigned") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("languages")
    .update({ name, iso_code: iso.value, is_signed: isSigned })
    .eq("id", Number(id));

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

// The autocomplete only carries { id, name }, so the edit form fetches the
// rest when a language is picked - otherwise saving an edit would silently
// blank out iso_code and is_signed for want of a starting value.
export async function getLanguageDetails(
  id: number,
): Promise<{ iso_code: string | null; is_signed: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("languages")
    .select("iso_code, is_signed")
    .eq("id", id)
    .maybeSingle();
  return { iso_code: data?.iso_code ?? null, is_signed: data?.is_signed ?? false };
}
