"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsername, isUsernameTaken, normalizeUsername } from "@/lib/username";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const username = normalizeUsername(formData.get("username") as string);
  const firstName = ((formData.get("firstName") as string) ?? "").trim();
  const lastName = ((formData.get("lastName") as string) ?? "").trim();
  const aboutMe = formData.get("aboutMe") as string;

  const t = await getTranslations("auth");
  const fail = (message: string): never =>
    redirect(`/profile/${user.id}?error=${encodeURIComponent(message)}`);

  // Same rule as registration, from the same module, so the editor can't
  // accept something the signup form refuses.
  if (username) {
    const problem = checkUsername(username);
    if (problem) fail(t(`identity.problem.${problem}`));
  }

  // An account with neither is the state 42 existing profiles are already
  // stuck in: they render as "CultureMesh member" everywhere. Don't let
  // the editor create more of them.
  if (!username && !firstName && !lastName) {
    fail(t("identity.needOne"));
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      first_name: firstName || null,
      last_name: lastName || null,
      about_me: aboutMe || null,
    })
    .eq("id", user.id);

  if (error) {
    // Was surfacing the raw unique-violation text, constraint name and all.
    fail(isUsernameTaken(error.message) ? t("identity.problem.taken") : error.message);
  }

  revalidatePath(`/profile/${user.id}`);
  redirect(`/profile/${user.id}?saved=1`);
}

export async function updateAvatarPath(imgPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  await supabase.from("profiles").update({ img_path: imgPath }).eq("id", user.id);
  revalidatePath(`/profile/${user.id}`);
}
