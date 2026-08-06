export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="6" cy="7" r="2.75" fill="currentColor" />
      <circle cx="18" cy="7" r="2.75" fill="currentColor" />
      <circle cx="12" cy="18" r="2.75" fill="currentColor" />
      <path
        d="M6 7L18 7M6 7L12 18M18 7L12 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
