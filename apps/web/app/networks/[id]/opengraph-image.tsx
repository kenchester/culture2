import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CultureMesh";

/**
 * A network's own share card - the recruiting surface a lonely founder
 * didn't have.
 *
 * Deliberately renders NO name as pixels - not the network's title, not
 * an origin, not a location. app/opengraph-image.tsx (the site-wide
 * default this overrides) explains why: those strings routinely contain
 * Chinese, Arabic or Cyrillic, and next/og renders whatever glyphs the
 * supplied font doesn't cover as empty boxes. "People from 厦门 in
 * Lansing" would share as tofu on exactly the card meant to make a
 * network look inviting enough to join.
 *
 * The actual name still reaches the person being shared to - it's
 * og:title, plain text metadata rendered by the chat client in its own
 * fonts (lib/share-metadata.ts), arriving intact in every script. This
 * image's only job is the part that's safe to bake as pixels: the member
 * count, which is always numeric, and a line of English inviting the
 * recipient to be next.
 */
export default async function NetworkOpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: network } = await supabase
    .from("networks")
    .select("member_count")
    .eq("id", Number(id))
    .maybeSingle();

  const members = network?.member_count ?? 0;
  // "Be the first/second member" reads as an invitation; "1 member"
  // reads as a statistic nobody wants to be the only data point in. Once
  // there are two or more, the count itself is the social proof and
  // needs no framing.
  const headline =
    members === 0
      ? "Be the first member"
      : members === 1
        ? "Be the second member"
        : `${members} members so far`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          background: "linear-gradient(135deg, #823f2b 0%, #a15036 55%, #c2654a 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1, opacity: 0.9, display: "flex" }}>
          CultureMesh
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2, display: "flex" }}>{headline}</div>
      </div>
    ),
    size,
  );
}
