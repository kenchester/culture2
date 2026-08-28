import { getTranslations } from "next-intl/server";
import { OtpForm } from "@/app/(auth)/otp-form";
import { AuthCard } from "@/components/auth-card";
import { getMainSiteUrl, isLearnHost } from "@/lib/site-url";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; embed?: string }>;
}) {
  const { returnTo, embed } = await searchParams;
  const t = await getTranslations("auth");
  const [onLearnHost, mainSiteUrl] = await Promise.all([isLearnHost(), getMainSiteUrl()]);

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")} embed={embed === "1"}>
      <OtpForm returnTo={returnTo} isLearnHost={onLearnHost} mainSiteUrl={mainSiteUrl} />
    </AuthCard>
  );
}
