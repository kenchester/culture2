import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// A recorded post/reply lives in the private post-media bucket
// (00000000000065_post_media_bucket.sql), unlike avatars' public bucket -
// lib/profiles.ts's getAvatarUrl is a plain synchronous getPublicUrl() and
// is imported by client components (e.g. app/nav.tsx), so it can't live
// there: this needs the service-role admin client to mint a signed URL on
// behalf of ANY viewer (posts are publicly readable, but the bucket's own
// RLS only lets an uploader read their own folder - see that migration's
// comment), which must never be reachable from client-bundled code.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4; // 4 hours - regenerated fresh on every render anyway

export async function getPostMediaUrl(mediaPath: string | null | undefined): Promise<string | null> {
  if (!mediaPath) {
    return null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("post-media")
    .createSignedUrl(mediaPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return null;
  }
  return data.signedUrl;
}
