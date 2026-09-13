import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type GatedContext = {
  networkId: number;
  networkTitle: string;
  orgName: string;
  orgSlug: string;
};

/**
 * Why a row came back empty: because it isn't there, or because the viewer
 * isn't in the school that owns it.
 *
 * RLS can't tell you which (00000000000078 filters the row out either way),
 * and that distinction is the whole difference between a useful page and a
 * dead end. A student following a classmate's link and getting "this page
 * doesn't exist" has no idea that signing in would fix it.
 *
 * This looks past RLS with the service-role client to answer that one
 * question. It deliberately discloses that a post exists in a named school
 * network - that is the point, since the reader is being invited to sign in
 * and read it - but never the post's content, which stays behind RLS and is
 * re-fetched through the viewer's own client once they authenticate.
 *
 * Demo organizations are excluded: their content is readable by anyone, so
 * a miss there really is a miss.
 */
async function gatedContextForNetwork(networkId: number): Promise<GatedContext | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("organization_languages")
    .select("network_id, organization:organizations(name, slug, is_example), network:networks(title)")
    .eq("network_id", networkId)
    .maybeSingle();

  if (!data) return null;
  const org = data.organization as unknown as {
    name: string;
    slug: string;
    is_example: boolean;
  } | null;
  if (!org || org.is_example) return null;

  const network = data.network as unknown as { title: string } | null;
  return {
    networkId,
    networkTitle: network?.title ?? "",
    orgName: org.name,
    orgSlug: org.slug,
  };
}

/** As above, for a network reached indirectly through one of its posts. */
export async function gatedContextForPost(postId: string | number): Promise<GatedContext | null> {
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("network_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return null;
  return gatedContextForNetwork(post.network_id as number);
}

export { gatedContextForNetwork };
