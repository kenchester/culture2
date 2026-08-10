import { OtpForm } from "@/app/(auth)/otp-form";
import { AuthCard } from "@/components/auth-card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; embed?: string }>;
}) {
  const { returnTo, embed } = await searchParams;

  return (
    <AuthCard
      title="Sign in or create an account"
      subtitle="Find your people, wherever you are."
      embed={embed === "1"}
    >
      <OtpForm returnTo={returnTo} />
    </AuthCard>
  );
}
