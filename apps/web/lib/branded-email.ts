// Renders every branded email this app sends outside of transactional
// auth mail (Supabase's own OTP emails) into one consistent look, not bare
// "<div>text</div>": the Site-Wide Update and the unconfirmed-signup nudge
// (app/api/cron/signup-reminders) both go out under the general
// "CultureMesh" brand, while the Onboarded/Yet-to-be-onboarded School
// outreach (app/admin/product-updates/actions.ts) goes to program
// contacts under the "CultureMesh Learn" sub-brand - same shell, different
// header/tagline/footer/CTA. Deliberately NOT the Campus Zine theme
// (app/globals.css's data-theme "zine") - that's the student-facing look
// for learn.culturemesh.com itself; every audience here (a general user
// reading a changelog, someone finishing sign-up, or a program
// coordinator sizing up the product) calls for the site's other,
// warm-editorial palette instead (same tokens as app/(marketing)/contact
// and the rest of the plain-host site).
//
// Email-safe system font stacks, not the site's actual webfonts - most
// mail clients strip @font-face/custom fonts outright, so reaching for one
// here would silently fall back to whatever's most convenient for that
// client rather than something chosen. A serif header + sans body using
// fonts every client already ships still reads as considered rather than
// default.
const SERIF_STACK = "Georgia, 'Times New Roman', Times, serif";
const SANS_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const INK = "#241f1b";
const BODY_TEXT = "#4a423c";
const MUTED = "#857a70";
const BORDER = "#e4dcd3";
const PRIMARY = "#b75b3d";
const BACKGROUND = "#fbf8f4";
const SURFACE = "#ffffff";

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Brand = {
  // The word after "CultureMesh" in the header, set in the accent color -
  // omitted entirely for the general-audience brand (just "CultureMesh"),
  // present for the Learn sub-brand ("CultureMesh Learn").
  subBrand?: string;
  tagline: string;
  footerLabel: string;
};

type Cta = { label: string; url: string };

// text: markdown links reduced to "label (url)" for plain-text clients,
// plus the CTA (if any) as its own line - html: same links turned into
// real, brand-colored <a href>, plus the CTA as a solid button. escapeHtml
// runs first, which is safe for the URL too (a literal "&" in a query
// string, like the outreach contact link's "subject=...&message=...", is
// exactly what HTML expects escaped to "&amp;" inside an href attribute).
function renderBrandedEmail(body: string, brand: Brand, cta?: Cta): { text: string; html: string } {
  const text =
    body.replace(MARKDOWN_LINK, (_match, label: string, url: string) => `${label} (${url})`) +
    (cta ? `\n\n${cta.label}: ${cta.url}` : "");
  const linkedHtml = escapeHtml(body)
    .replace(
      MARKDOWN_LINK,
      (_match, label: string, url: string) =>
        `<a href="${url}" style="color:${PRIMARY};font-weight:600;text-decoration:underline;">${label}</a>`,
    )
    .replace(/\n/g, "<br>");
  const ctaHtml = cta
    ? `<div style="margin-top:24px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background-color:${PRIMARY};color:#ffffff;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;font-family:${SANS_STACK};font-size:15px;">${escapeHtml(cta.label)}</a></div>`
    : "";
  return { text, html: wrapBrandedShell(linkedHtml + ctaHtml, brand) };
}

// The Onboarded School / Yet-to-be-onboarded School outreach audiences.
export function renderOutreachEmail(body: string): { text: string; html: string } {
  return renderBrandedEmail(body, {
    subBrand: "Learn",
    tagline: "Language-Learning Networks",
    footerLabel: "CultureMesh Learn",
  });
}

// The Site-Wide Update audience - every user opted into product_updates
// emails, not a school-specific outreach list.
export function renderSiteUpdateEmail(body: string): { text: string; html: string } {
  return renderBrandedEmail(body, {
    tagline: "Connecting Global Diasporas",
    footerLabel: "CultureMesh",
  });
}

// The unconfirmed-signup nudge (app/api/cron/signup-reminders) - cta is
// the one-click finish-signing-in link (app/sign-in/confirm), always
// present here unlike the other two callers.
export function renderSignupReminderEmail(body: string, cta: Cta): { text: string; html: string } {
  return renderBrandedEmail(
    body,
    { tagline: "Connecting Global Diasporas", footerLabel: "CultureMesh" },
    cta,
  );
}

// Table-based layout throughout, not flexbox/grid - Outlook desktop's Word
// rendering engine ignores most modern CSS, so tables remain the one
// layout primitive that behaves the same across every major mail client.
function wrapBrandedShell(innerHtml: string, brand: Brand): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${BACKGROUND};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BACKGROUND};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:${SURFACE};border:1px solid ${BORDER};border-radius:12px;">
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background-color:${PRIMARY};border-radius:12px 12px 0 0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="font-family:${SERIF_STACK};font-size:22px;color:${INK};">
                  CultureMesh${brand.subBrand ? ` <span style="color:${PRIMARY};">${brand.subBrand}</span>` : ""}
                </div>
                <div style="font-family:${SANS_STACK};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};margin-top:6px;">
                  ${brand.tagline}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px 40px;font-family:${SANS_STACK};font-size:15px;line-height:1.7;color:${BODY_TEXT};">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px 40px;">
                <div style="border-top:1px solid ${BORDER};padding-top:16px;font-family:${SANS_STACK};font-size:12px;color:${MUTED};">
                  ${brand.footerLabel} &middot; <a href="https://culturemesh.com" style="color:${MUTED};">culturemesh.com</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
