import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { updateProfile } from "@/app/profile/actions";
import { AvatarUpload } from "@/app/profile/[id]/avatar-upload";
import { startConversation } from "@/app/messages/actions";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  // This page is otherwise unlocalised; the identity copy is translated
  // because it is the part someone has to understand to stay safe.
  const ti = await getTranslations("auth");
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
          <SubmitButton>Message</SubmitButton>
        </form>
      )}

      {isOwnProfile && (
        <div className="flex flex-col gap-6 border-t border-border pt-6">
          <AvatarUpload userId={profile.id} />
          {saved && (
            <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
              Profile saved.
            </p>
          )}
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
          )}
          <form action={updateProfile} className="flex flex-col gap-4">
            {/* The field existed here with no label beyond "Username" and
                no hint that it is the thing standing in for a real name.
                Anyone who needs a pseudonym had to guess that. */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-primary-light/40 p-3">
              <p className="font-medium text-ink">{ti("identity.heading")}</p>
              <p className="text-sm text-body">{ti("identity.explainer")}</p>
              <p className="text-sm text-ink">
                {ti("identity.currentlyShown", { name: getDisplayName(profile) })}
              </p>
            </div>
            <Field>
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" defaultValue={profile.username ?? ""} />
              <p className="text-xs text-muted">{ti("identity.usernameHelp")}</p>
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
              {/* Stated plainly, because the precedence is not guessable
                  and guessing wrong here publishes a real name. */}
              <p className="text-xs text-muted">{ti("identity.bothNote")}</p>
            </Field>
            <Field>
              <Label htmlFor="aboutMe">About me</Label>
              <Textarea
                id="aboutMe"
                name="aboutMe"
                defaultValue={profile.about_me ?? ""}
              />
            </Field>
            <SubmitButton>Save</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
