"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Field, fieldClass, Input, Label, Textarea } from "@/components/ui/input";

// "CultureMesh Learn Interest" and "Embassy or partner inquiry" each need
// a follow-up field (which school/program, or which embassy/partner), so
// the subject select has to be interactive - the rest of this form stays a
// plain server-rendered <form action={sendContactMessage}>
// (app/(marketing)/contact/page.tsx); this is just the reactive slice of
// it, rendered inside that same form so its fields still submit normally.
// Both share the same "institution" field name (just a different label per
// subject) rather than two separate fields - sendContactMessage already
// folds whichever one is present into the email the same way.
const LEARN_SUBJECT = "CultureMesh Learn Interest";
const EMBASSY_SUBJECT = "Embassy or partner inquiry";

// Asking for a language or a place we don't carry yet. Reached from the
// note under the search box on /training, where hitting a missing language
// is most likely.
const REQUEST_SUBJECT = "Language or geography request";

const REQUEST_KINDS = ["Language", "Country", "Region", "City"] as const;
type RequestKind = (typeof REQUEST_KINDS)[number];

// The message box is part of this component rather than the page so its
// label can change with the subject: for a language or geography request,
// "Message" doesn't tell anyone what to type.
export function SubjectField({
  initialSubject,
  initialInstitution,
  initialMessage,
  initialRequestKind,
}: {
  initialSubject?: string;
  initialInstitution?: string;
  initialMessage?: string;
  initialRequestKind?: string;
}) {
  const t = useTranslations("contact");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [requestKind, setRequestKind] = useState<RequestKind | "">(
    (REQUEST_KINDS as readonly string[]).includes(initialRequestKind ?? "")
      ? (initialRequestKind as RequestKind)
      : "",
  );

  const isRequest = subject === REQUEST_SUBJECT;
  // A country is required to place either one: a region without its
  // country is ambiguous (there are several Georgias), and a city needs it
  // for the same reason.
  const needsCountry = isRequest && (requestKind === "Region" || requestKind === "City");
  // The region is optional because plenty of countries don't have one worth
  // naming, and the requester may not know which their city falls under.
  const needsRegion = isRequest && requestKind === "City";

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
          <option value={EMBASSY_SUBJECT}>{t("subjects.embassy")}</option>
          <option value={LEARN_SUBJECT}>{t("subjects.learn")}</option>
          <option value={REQUEST_SUBJECT}>{t("subjects.request")}</option>
          <option value="Privacy or data request">{t("subjects.privacy")}</option>
          <option value="Other">{t("subjects.other")}</option>
        </select>
      </Field>

      {(subject === LEARN_SUBJECT || subject === EMBASSY_SUBJECT) && (
        <Field>
          <Label htmlFor="institution">
            {subject === LEARN_SUBJECT ? t("institutionLabel") : t("embassyLabel")}
          </Label>
          <Input id="institution" name="institution" required defaultValue={initialInstitution} />
        </Field>
      )}

      {isRequest && (
        <Field>
          <Label htmlFor="requestKind">{t("requestKindLabel")}</Label>
          <select
            id="requestKind"
            name="requestKind"
            required
            value={requestKind}
            onChange={(e) => setRequestKind(e.target.value as RequestKind)}
            className={fieldClass}
          >
            <option value="" disabled>
              {t("requestKindPlaceholder")}
            </option>
            {REQUEST_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`requestKinds.${kind.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {needsCountry && (
        // Keyed so switching between Region and City clears a half-typed
        // entry rather than leaving a stale name above a changed question.
        <AutocompleteField
          key={`country-${requestKind}`}
          label={t("requestCountryLabel")}
          kind="place"
          placeType="country"
          hiddenName="requestCountryId"
          queryName="requestCountry"
          required
        />
      )}

      {needsRegion && (
        <AutocompleteField
          key="region"
          label={t("requestRegionLabel")}
          kind="place"
          placeType="region"
          hiddenName="requestRegionId"
          queryName="requestRegion"
        />
      )}

      <Field>
        <Label htmlFor="message">{isRequest ? t("requestMessageLabel") : t("messageLabel")}</Label>
        <Textarea id="message" name="message" required rows={6} defaultValue={initialMessage ?? ""} />
      </Field>
    </>
  );
}
