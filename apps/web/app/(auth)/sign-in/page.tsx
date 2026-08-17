import { getTranslations } from "next-intl/server";
import { OtpForm } from "@/app/(auth)/otp-form";
import { AuthCard } from "@/components/auth-card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; embed?: string }>;
}) {
  const { returnTo, embed } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")} embed={embed === "1"}>
      <OtpForm returnTo={returnTo} />
    </AuthCard>
  );
}
