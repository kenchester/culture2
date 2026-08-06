"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const username = formData.get("username") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const aboutMe = formData.get("aboutMe") as string;

  const { error } = await supabase
    .from("profiles")
    .update({
      username: username || null,
      first_name: firstName || null,
      last_name: lastName || null,
      about_me: aboutMe || null,
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/profile/${user.id}?error=${encodeURIComponent(error.message)}`);
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
