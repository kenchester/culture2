"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinNetwork(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to join a network.")}`);
  }

  await supabase
    .from("network_members")
    .insert({ network_id: Number(networkId), user_id: user.id });

  revalidatePath(`/networks/${networkId}`);
}

export async function leaveNetwork(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to manage your networks.")}`);
  }

  await supabase
    .from("network_members")
    .delete()
    .eq("network_id", Number(networkId))
    .eq("user_id", user.id);

  revalidatePath(`/networks/${networkId}`);
}

export async function createPost(formData: FormData) {
  const networkId = formData.get("networkId") as string;
  const body = formData.get("body") as string;
  const videoUrl = formData.get("videoUrl") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to post.")}`);
  }

  const { error } = await supabase.from("posts").insert({
    network_id: Number(networkId),
    user_id: user.id,
    body,
    video_url: videoUrl || null,
  });

  if (error) {
    redirect(`/networks/${networkId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/networks/${networkId}`);
}
