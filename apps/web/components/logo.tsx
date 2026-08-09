import Image from "next/image";

export function Logo({ className = "h-8", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.svg"
      alt="CultureMesh"
      width={480}
      height={114}
      priority={priority}
      className={`w-auto ${className}`}
    />
  );
}
