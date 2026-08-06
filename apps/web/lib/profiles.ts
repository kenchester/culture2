import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

export function getDisplayName(profile: ProfileNameFields) {
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username ||
    "CultureMesh member"
  );
}

export function getAvatarUrl(
  supabase: SupabaseClient,
  imgPath: string | null | undefined,
) {
  return imgPath
    ? supabase.storage.from("avatars").getPublicUrl(imgPath).data.publicUrl
    : null;
}
