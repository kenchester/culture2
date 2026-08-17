import { getTranslations } from "next-intl/server";
import { sendContactMessage } from "@/app/(marketing)/contact/actions";
import { Button } from "@/components/ui/button";
import { Field, fieldClass, Input, Label, Textarea } from "@/components/ui/input";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-ink">{t("heading")}</h1>
        <p className="text-body">{t("intro")}</p>
      </div>

      {sent && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {t("sent")}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}

      <form action={sendContactMessage} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="name">{t("nameLabel")}</Label>
          <Input id="name" name="name" required />
        </Field>
        <Field>
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field>
          <Label htmlFor="subject">{t("subjectLabel")}</Label>
          <select id="subject" name="subject" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              {t("subjectPlaceholder")}
            </option>
            <option value="General question">{t("subjects.general")}</option>
            <option value="Report a problem">{t("subjects.problem")}</option>
            <option value="Embassy or partner inquiry">{t("subjects.embassy")}</option>
            <option value="Privacy or data request">{t("subjects.privacy")}</option>
            <option value="Other">{t("subjects.other")}</option>
          </select>
        </Field>
        <Field>
          <Label htmlFor="message">{t("messageLabel")}</Label>
          <Textarea id="message" name="message" required rows={6} />
        </Field>
        <Button type="submit" className="self-start">
          {t("submit")}
        </Button>
      </form>
    </div>
  );
}
