import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { updateProfile } from "@/app/profile/actions";
import { AvatarUpload } from "@/app/profile/[id]/avatar-upload";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, about_me, img_path")
    .eq("id", id)
    .single();

  if (!profile) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  const avatarUrl = getAvatarUrl(supabase, profile.img_path);
  const displayName = getDisplayName(profile);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={64}
            height={64}
            priority
            className="rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-zinc-200" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          {profile.username && (
            <p className="text-sm text-zinc-600">@{profile.username}</p>
          )}
        </div>
      </div>

      {profile.about_me && <p>{profile.about_me}</p>}

      {isOwnProfile && (
        <div className="flex flex-col gap-6 border-t pt-6">
          <AvatarUpload userId={profile.id} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <form action={updateProfile} className="flex flex-col gap-4">
            <input
              name="username"
              defaultValue={profile.username ?? ""}
              placeholder="Username"
              className="rounded border px-3 py-2"
            />
            <input
              name="firstName"
              defaultValue={profile.first_name ?? ""}
              placeholder="First name"
              className="rounded border px-3 py-2"
            />
            <input
              name="lastName"
              defaultValue={profile.last_name ?? ""}
              placeholder="Last name"
              className="rounded border px-3 py-2"
            />
            <textarea
              name="aboutMe"
              defaultValue={profile.about_me ?? ""}
              placeholder="About me"
              className="rounded border px-3 py-2"
            />
            <button type="submit" className="rounded bg-black px-3 py-2 text-white">
              Save
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
