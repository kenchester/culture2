import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  embed,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  embed?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {embed ? (
          <div className="flex items-center justify-center">
            <Logo className="h-9" />
          </div>
        ) : (
          <Link href="/" className="flex items-center justify-center">
            <Logo className="h-9" />
          </Link>
        )}
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-display text-2xl text-ink">{title}</h1>
            {subtitle && <p className="text-sm text-body">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="text-center text-sm text-body">{footer}</div>}
      </div>
    </div>
  );
}
