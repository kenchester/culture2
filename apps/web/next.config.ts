import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // dictionary-en/es/fr resolve their .aff/.dic files via
  // `new URL(..., import.meta.url)` + fs.readFile - bundling that through
  // Turbopack mangles the resulting URL (breaks at build time with
  // "must be of type string or an instance of Buffer or URL. Received an
  // instance of URL"). Left external, Node resolves them natively at
  // runtime instead, which works correctly. nspell is included alongside
  // since it's imported from the same module (lib/language-purity-check.ts).
  serverExternalPackages: ["nspell", "dictionary-en", "dictionary-es", "dictionary-fr"],
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
