import Image from "next/image";

// When this sits inside a link (the nav's home link, the auth card's), the
// alt text IS that link's accessible name - so callers in a position to
// translate pass a localized, purpose-describing string ("CultureMesh -
// home") rather than leaving every locale with the bare brand name. The
// default stays the untranslated brand name for the standalone,
// non-linked uses, where the product name is genuinely all there is to
// convey.
export function Logo({
  className = "h-8",
  priority = false,
  alt = "CultureMesh",
}: {
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src="/logo.svg"
      alt={alt}
      width={480}
      height={114}
      priority={priority}
      className={`w-auto ${className}`}
    />
  );
}
