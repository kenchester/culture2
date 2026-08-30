"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Saves the request and notifies Ken - approval/rejection itself happens in
// app/admin/organizations/actions.ts (approveOrganizationRequest /
// rejectOrganizationRequest), which is what actually provisions the org.
export async function submitOrganizationRequest(formData: FormData) {
  const instructorName = (formData.get("instructorName") as string)?.trim();
  const profileUrl = (formData.get("profileUrl") as string)?.trim();
  const schoolName = (formData.get("schoolName") as string)?.trim();
  const languageId = Number(formData.get("languageId"));
  const parentPlaceId = Number(formData.get("parentPlaceId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/sign-in?returnTo=${encodeURIComponent("/learn/start")}`);
  }

  if (!instructorName || !profileUrl || !schoolName || !languageId || !parentPlaceId) {
    redirect(`/learn/start?error=${encodeURIComponent("All fields are required.")}`);
  }

  if (!isValidUrl(profileUrl)) {
    redirect(`/learn/start?error=${encodeURIComponent("Enter a valid profile URL, including https://.")}`);
  }

  const { error } = await supabase.from("organization_requests").insert({
    requested_by: user.id,
    institutional_email: user.email,
    profile_url: profileUrl,
    school_name: schoolName,
    language_id: languageId,
    parent_place_id: parentPlaceId,
  });

  if (error) {
    redirect(`/learn/start?error=${encodeURIComponent(error.message)}`);
  }

  // Best-effort - the request is already saved above, so an email hiccup
  // here shouldn't turn a successful submission into an error for the
  // person submitting it.
  try {
    await sendEmail({
      to: "kenchester2@gmail.com",
      subject: `[CultureMesh Learn] New class request: ${schoolName}`,
      text: `${instructorName} (${user.email}) requested a free class at ${schoolName}.\n\nProfile: ${profileUrl}\n\nReview: https://culturemesh.com/admin/organizations`,
    });
  } catch {
    // Ignore - see comment above.
  }

  redirect("/learn/start?sent=1");
}
