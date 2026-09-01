"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, fieldClass, Input, Label } from "@/components/ui/input";

// Only "CultureMesh Learn Interest" needs a follow-up field (which school/
// program), so the subject select has to be interactive - the rest of this
// form stays a plain server-rendered <form action={sendContactMessage}>
// (app/(marketing)/contact/page.tsx); this is just the reactive slice of
// it, rendered inside that same form so its fields still submit normally.
const LEARN_SUBJECT = "CultureMesh Learn Interest";

export function SubjectField({
  initialSubject,
  initialInstitution,
}: {
  initialSubject?: string;
  initialInstitution?: string;
}) {
  const t = useTranslations("contact");
  const [subject, setSubject] = useState(initialSubject ?? "");

  return (
    <>
      <Field>
        <Label htmlFor="subject">{t("subjectLabel")}</Label>
        <select
          id="subject"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={fieldClass}
        >
          <option value="" disabled>
            {t("subjectPlaceholder")}
          </option>
          <option value="General question">{t("subjects.general")}</option>
          <option value="Report a problem">{t("subjects.problem")}</option>
          <option value="Embassy or partner inquiry">{t("subjects.embassy")}</option>
          <option value={LEARN_SUBJECT}>{t("subjects.learn")}</option>
          <option value="Privacy or data request">{t("subjects.privacy")}</option>
          <option value="Other">{t("subjects.other")}</option>
        </select>
      </Field>
      {subject === LEARN_SUBJECT && (
        <Field>
          <Label htmlFor="institution">{t("institutionLabel")}</Label>
          <Input id="institution" name="institution" required defaultValue={initialInstitution} />
        </Field>
      )}
    </>
  );
}
