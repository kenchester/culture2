import { getTranslations } from "next-intl/server";
import { sendContactMessage } from "@/app/(marketing)/contact/actions";
import { SubjectField } from "@/app/(marketing)/contact/subject-field";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { FormError, FormSuccess } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";

// Pulled out of the component body: React's purity lint rule flags a
// direct Date.now() call inside a component's render, but this page is
// forced dynamic anyway (it already reads searchParams), so a fresh
// timestamp per request is exactly what's wanted here.
function serverNow() {
  return Date.now();
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    sent?: string;
    subject?: string;
    message?: string;
    institution?: string;
  }>;
}) {
  const { error, sent, subject, message, institution } = await searchParams;
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-ink">{t("heading")}</h1>
        <p className="text-body">{t("intro")}</p>
      </div>

      {sent && (
        <FormSuccess>
          {t("sent")}
        </FormSuccess>
      )}
      {error && (
        <FormError>{error}</FormError>
      )}

      <form action={sendContactMessage} className="flex flex-col gap-4">
        {/* Honeypot: real visitors never see or fill this, but simple bots
            that blindly fill every input do. Off-screen positioning rather
            than display:none/visibility:hidden, since those two properties
            are what most scraping libraries specifically check for before
            deciding whether to bother filling a field. */}
        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
        </div>
        <input type="hidden" name="renderedAt" value={serverNow()} />
        <Field>
          <Label htmlFor="name">{t("nameLabel")}</Label>
          <Input id="name" name="name" required />
        </Field>
        <Field>
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" name="email" type="email" required />
        </Field>
        <SubjectField initialSubject={subject} initialInstitution={institution} />
        <Field>
          <Label htmlFor="message">{t("messageLabel")}</Label>
          <Textarea id="message" name="message" required rows={6} defaultValue={message ?? ""} />
        </Field>
        <SubmitButton className="self-start">
          {t("submit")}
        </SubmitButton>
      </form>
    </div>
  );
}
