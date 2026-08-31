import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const VERIFICATION_CODE_TTL_MINUTES = 15;

// Shared by app/learn/[slug]/actions.ts's requestEmailVerificationCode
// (proving you control a specific school's email while already on that
// school's own page) and app/learn/actions.ts's requestAddSchoolCode
// (the same proof, but starting from an email address before knowing
// which school it belongs to) - both need the identical
// generate-store-send step, just reached from different entry points.
// Unlike the best-effort notification emails elsewhere in this app, a
// failed send here has to be a real, surfaced error - the code IS the
// point of this request.
export async function sendSchoolVerificationCode(
  profileId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await admin
    .from("pending_email_verifications")
    .insert({ profile_id: profileId, email, code, expires_at: expiresAt });
  if (insertError) {
    return { ok: false, error: "Could not send a code. Try again." };
  }

  try {
    await sendEmail({
      to: email,
      subject: "Your CultureMesh verification code",
      text: `Your verification code is ${code}. It expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.\n\nIf you didn't request this, you can ignore this email.`,
    });
  } catch {
    return { ok: false, error: "Could not send the email. Try again." };
  }

  return { ok: true };
}
