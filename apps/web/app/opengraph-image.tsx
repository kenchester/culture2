import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CultureMesh";

/**
 * The card image behind every shared link.
 *
 * Deliberately brand-only, with the specific title left to og:title. A
 * per-page image rendering the network's own name would be better looking
 * and worse: place and network names here include Chinese, Arabic and
 * Cyrillic, and next/og renders whatever glyphs the supplied font covers
 * as empty boxes. "People from 厦门 in Lansing" would share as tofu.
 * og:title is rendered by the chat client in its own fonts, so the
 * specific text goes there and arrives intact in every script.
 *
 * Revisit with a real font subset if per-network images become worth the
 * weight.
 */
export default function OpengraphImage() {
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
          gap: 28,
          // The terracotta from the app's own palette, deepened so white
          // type sits on it comfortably.
          background: "linear-gradient(135deg, #823f2b 0%, #a15036 55%, #c2654a 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -2,
            display: "flex",
          }}
        >
          CultureMesh
        </div>
        <div style={{ fontSize: 40, opacity: 0.9, display: "flex" }}>
          Find your diaspora network
        </div>
      </div>
    ),
    size,
  );
}
