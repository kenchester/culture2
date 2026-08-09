import { sendContactMessage } from "@/app/(marketing)/contact/actions";
import { Button } from "@/components/ui/button";
import { Field, fieldClass, Input, Label, Textarea } from "@/components/ui/input";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-ink">Contact Us</h1>
        <p className="text-body">
          Have a question, a problem with your account, or an idea for
          CultureMesh? Send us a message and we&apos;ll get back to you.
        </p>
      </div>

      {sent && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          Message sent. We&apos;ll get back to you soon.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}

      <form action={sendContactMessage} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required />
        </Field>
        <Field>
          <Label htmlFor="email">Your email</Label>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field>
          <Label htmlFor="subject">Subject</Label>
          <select id="subject" name="subject" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Choose a subject
            </option>
            <option value="General question">General question</option>
            <option value="Report a problem">Report a problem</option>
            <option value="Embassy or partner inquiry">Embassy or partner inquiry</option>
            <option value="Privacy or data request">Privacy or data request</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field>
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" name="message" required rows={6} />
        </Field>
        <Button type="submit" className="self-start">
          Send message
        </Button>
      </form>
    </div>
  );
}
