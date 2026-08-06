"use client";

import { useState } from "react";
import { Field, Input, Label } from "@/components/ui/input";

// datetime-local inputs have no timezone info, so a bare value like
// "2026-10-15T18:00" submitted to the server is ambiguous - the server has
// no way to know which timezone the user meant. Converting to a full ISO
// timestamp has to happen here, in the browser, which is the only place
// that actually knows the user's local timezone.
export function EventDateField() {
  const [localValue, setLocalValue] = useState("");
  const iso = localValue ? new Date(localValue).toISOString() : "";

  return (
    <Field>
      <Label htmlFor="event-date">Date and time</Label>
      <Input
        id="event-date"
        type="datetime-local"
        required
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
      <input type="hidden" name="eventDate" value={iso} />
    </Field>
  );
}
