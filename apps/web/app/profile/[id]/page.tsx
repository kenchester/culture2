import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { updateProfile } from "@/app/profile/actions";
import { AvatarUpload } from "@/app/profile/[id]/avatar-upload";
import { startConversation } from "@/app/messages/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";

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
          <div className="h-16 w-16 rounded-full bg-border" />
        )}
        <div>
          <h1 className="font-display text-3xl text-ink">{displayName}</h1>
          {profile.username && <p className="text-sm text-muted">@{profile.username}</p>}
        </div>
      </div>

      {profile.about_me && <p className="text-body">{profile.about_me}</p>}

      {user && !isOwnProfile && (
        <form action={startConversation}>
          <input type="hidden" name="otherUserId" value={profile.id} />
          <Button type="submit">Message</Button>
        </form>
      )}

      {isOwnProfile && (
        <div className="flex flex-col gap-6 border-t border-border pt-6">
          <AvatarUpload userId={profile.id} />
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
          )}
          <form action={updateProfile} className="flex flex-col gap-4">
            <Field>
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" defaultValue={profile.username ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={profile.first_name ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" defaultValue={profile.last_name ?? ""} />
            </Field>
            <Field>
              <Label htmlFor="aboutMe">About me</Label>
              <Textarea
                id="aboutMe"
                name="aboutMe"
                defaultValue={profile.about_me ?? ""}
              />
            </Field>
            <Button type="submit">Save</Button>
          </form>
        </div>
      )}
    </div>
  );
}
