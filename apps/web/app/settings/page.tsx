import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { updateNotificationPrefs, updatePassword } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { HiddenUsernameField } from "@/components/ui/hidden-username-field";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    passwordError?: string;
    passwordSaved?: string;
  }>;
}) {
  const { error, saved, passwordError, passwordSaved } = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations("settings");
  const tAuth = await getTranslations("auth");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: prefs }, { data: profile }] = await Promise.all([
    supabase
      .from("notification_prefs")
      .select(
        "events_upcoming, network_activity, product_updates, replies_to_your_posts, likes_on_your_posts",
      )
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("has_password").eq("id", user.id).single(),
  ]);

  const hasPassword = Boolean(profile?.has_password);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-center font-display text-2xl text-ink">{t("heading")}</h1>
      {saved && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{t("saved")}</p>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="font-medium text-ink">{t("notifications.heading")}</h2>
        <form action={updateNotificationPrefs} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="events_upcoming"
              defaultChecked={prefs?.events_upcoming ?? true}
            />
            {t("notifications.events")}
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="network_activity"
              defaultChecked={prefs?.network_activity ?? true}
            />
            {t("notifications.networkActivity")}
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="replies_to_your_posts"
              defaultChecked={prefs?.replies_to_your_posts ?? true}
            />
            {t("notifications.repliesToYourPosts")}
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="likes_on_your_posts"
              defaultChecked={prefs?.likes_on_your_posts ?? true}
            />
            {t("notifications.likesOnYourPosts")}
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="product_updates"
              defaultChecked={prefs?.product_updates ?? true}
            />
            {t("notifications.productUpdates")}
          </label>
          <Button type="submit" className="w-full">
            {t("notifications.save")}
          </Button>
        </form>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="font-medium text-ink">{t("password.heading")}</h2>
        <p className="text-sm text-body">{t("password.help")}</p>
        {passwordSaved && (
          <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
            {t("password.saved")}
          </p>
        )}
        {passwordError && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{passwordError}</p>
        )}
        <form action={updatePassword} className="flex flex-col gap-4">
          <HiddenUsernameField email={user.email ?? ""} />
          <Field>
            <Label htmlFor="password">{t("password.label")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              showLabel={tAuth("password.show")}
              hideLabel={tAuth("password.hide")}
            />
          </Field>
          <Button type="submit" className="w-full">
            {hasPassword ? t("password.updateSubmit") : t("password.setSubmit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
