"use client";

import { useTranslations } from "next-intl";

function WhatsAppIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.09c-.24.68-1.4 1.3-1.93 1.38-.49.08-1.11.11-1.8-.11-.41-.13-.95-.31-1.63-.6-2.87-1.24-4.74-4.14-4.89-4.33-.14-.2-1.17-1.55-1.17-2.96 0-1.4.74-2.09 1-2.38.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.17.01.41-.07.64.49.24.57.81 1.98.88 2.12.07.15.12.32.02.51-.09.2-.14.32-.28.49-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.17-.19.71-.83.9-1.11.19-.28.38-.23.63-.14.26.1 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

/**
 * The deep link, not the Business API.
 *
 * wa.me/?text=... is the whole feature: no Meta Business account, no
 * phone number registration, no verification - it just opens WhatsApp
 * with this message already typed, and the person picks which of THEIR
 * chats to send it to. That is also the ceiling of what it can do. The
 * WhatsApp Business API cannot post into an existing group someone else
 * created - a business number can only message individual people who
 * have opted in, one at a time - so there is no version of this that
 * posts into a group automatically. What exists here is the one honest
 * piece of that idea buildable with zero infrastructure: handing someone
 * the message, ready to paste into the group themselves.
 *
 * A second, explicit option alongside ShareLink rather than inside it.
 * ShareLink's own native share sheet already reaches WhatsApp on a phone
 * where it's installed - this exists for the case that doesn't cover:
 * desktop, or a visitor who wants WhatsApp specifically rather than
 * whatever the OS sheet offers first. Diaspora communities skew heavily
 * toward organising on WhatsApp already (the Canton Fair freight
 * consolidators in this project's own research used a WhatsApp QR code,
 * not a generic link), which is why this gets its own button here rather
 * than waiting to be the fourth option in a share sheet.
 */
export function WhatsAppShareLink({
  path,
  text,
  className = "",
}: {
  path: string;
  /** The message, with the link already appended - built by the caller
   *  so this component never has to guess wording per context. */
  text: string;
  className?: string;
}) {
  const t = useTranslations("share");

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    const url = new URL(path, window.location.origin).toString();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <a
      href="https://wa.me/"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:border-primary hover:text-primary ${className}`}
    >
      <WhatsAppIcon />
      {t("whatsapp")}
    </a>
  );
}
