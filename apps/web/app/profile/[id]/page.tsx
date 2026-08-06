import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { updateProfile } from "@/app/profile/actions";
import { AvatarUpload } from "@/app/profile/[id]/avatar-upload";
import { startConversation } from "@/app/messages/actions";

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

      {user && !isOwnProfile && (
        <form action={startConversation}>
          <input type="hidden" name="otherUserId" value={profile.id} />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            Message
          </button>
        </form>
      )}

      {isOwnProfile && (
        <div className="flex flex-col gap-6 border-t pt-6">
          <AvatarUpload userId={profile.id} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <form action={updateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                name="username"
                defaultValue={profile.username ?? ""}
                className="rounded border px-3 py-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                defaultValue={profile.first_name ?? ""}
                className="rounded border px-3 py-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                defaultValue={profile.last_name ?? ""}
                className="rounded border px-3 py-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="aboutMe" className="text-sm font-medium">
                About me
              </label>
              <textarea
                id="aboutMe"
                name="aboutMe"
                defaultValue={profile.about_me ?? ""}
                className="rounded border px-3 py-2"
              />
            </div>
            <button type="submit" className="rounded bg-black px-3 py-2 text-white">
              Save
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
