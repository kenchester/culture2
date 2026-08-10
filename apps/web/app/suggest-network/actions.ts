"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function suggestNetwork(formData: FormData) {
  const kind = formData.get("kind") as string;
  const suggestionText = formData.get("suggestionText") as string;
  const placeType = kind === "place" ? (formData.get("placeType") as string) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?error=${encodeURIComponent("Sign in to suggest a network.")}`);
  }

  const { error } = await supabase.from("suggested_networks").insert({
    suggested_by: user.id,
    kind,
    suggestion_text: suggestionText,
    place_type: placeType,
  });

  if (error) {
    redirect(`/suggest-network?error=${encodeURIComponent(error.message)}`);
  }

  // Best-effort notification - the suggestion is already saved above, so an
  // email hiccup here shouldn't turn a successful suggestion into an error
  // for the person submitting it.
  await resend.emails
    .send({
      from: "CultureMesh Suggestions <noreply@culturemesh.com>",
      to: "kenchester2@gmail.com",
      subject: `[Suggestion] ${kind === "language" ? "Language" : `Place (${placeType})`}: ${suggestionText}`,
      text: `${user.email} suggested a ${kind}: ${suggestionText}${placeType ? ` (${placeType})` : ""}`,
    })
    .catch(() => {});

  redirect("/suggest-network?sent=1");
}
