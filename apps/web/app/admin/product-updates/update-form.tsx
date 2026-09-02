"use client";

import { useState } from "react";
import { postProductUpdate, sendOutreachEmail } from "@/app/admin/product-updates/actions";
import { GREETINGS, OUTREACH_TEMPLATES, type OutreachKind } from "@/app/admin/product-updates/outreach-templates";
import { Button } from "@/components/ui/button";
import { Field, fieldClass, Input, Label, Textarea } from "@/components/ui/input";

type Audience = "site-wide" | OutreachKind;

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "site-wide", label: "Site-Wide Update" },
  { value: "onboarded", label: "Onboarded School" },
  { value: "prospective", label: "Yet-to-be-onboarded School" },
];

// Site-Wide posts to product_updates and emails every opted-in user
// (postProductUpdate, unchanged). The other two audiences are a completely
// different action (sendOutreachEmail) - a curated, pasted list of
// addresses, often not users at all yet - so switching the radio swaps
// both which fields render (greeting + recipient emails) and which action
// the form submits to, not just the button label.
export function UpdateForm() {
  const [audience, setAudience] = useState<Audience>("site-wide");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Starts unselected on purpose, every time an outreach audience is
  // chosen (not just once) - a pre-picked default was too easy to send
  // straight past without noticing it still said "Good morning!" to a
  // recipient in a different time zone. Left blank + required forces a
  // deliberate choice each send.
  const [greeting, setGreeting] = useState("");

  const isOutreach = audience !== "site-wide";

  function selectAudience(next: Audience) {
    setAudience(next);
    if (next === "site-wide") {
      setTitle("");
      setBody("");
    } else {
      setTitle(OUTREACH_TEMPLATES[next].title);
      setBody(OUTREACH_TEMPLATES[next].body);
      setGreeting("");
    }
  }

  return (
    <form action={isOutreach ? sendOutreachEmail : postProductUpdate} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Audience</legend>
        <div className="flex flex-col gap-1.5">
          {AUDIENCES.map((a) => (
            <label key={a.value} className="flex items-center gap-2 text-sm text-body">
              <input
                type="radio"
                name="audience"
                checked={audience === a.value}
                onChange={() => selectAudience(a.value)}
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      {isOutreach && (
        <Field>
          <Label htmlFor="update-greeting">Greeting</Label>
          <select
            id="update-greeting"
            name="greeting"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            className={fieldClass}
            required
          >
            <option value="" disabled>
              Select a greeting...
            </option>
            {GREETINGS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field>
        <Label htmlFor="update-title">Title</Label>
        <Input
          id="update-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. New: reply notifications"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="update-body">Body</Label>
        <Textarea
          id="update-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's new..."
          rows={isOutreach ? 16 : 4}
          required
        />
      </Field>

      {isOutreach && (
        <Field>
          <Label htmlFor="update-emails">Recipient emails</Label>
          <Textarea
            id="update-emails"
            name="emails"
            placeholder="jane@school.edu, john@school.edu"
            rows={4}
            required
          />
        </Field>
      )}

      <Button type="submit" className="self-start">
        {isOutreach ? "Send Email" : "Publish Update"}
      </Button>
    </form>
  );
}
