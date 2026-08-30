import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  joined_at: string;
  network: { id: number; title: string; member_count: number; post_count: number } | null;
};

// Linked from the user dropdown (app/nav.tsx) - previously the only way
// back into a joined network was search or a bookmark. Most-recently-joined
// first, matching network_members.joined_at (00000000000001_initial_schema.sql).
export default async function MyNetworksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: memberships } = await supabase
    .from("network_members")
    .select("joined_at, network:networks(id, title, member_count, post_count)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const t = await getTranslations("myNetworks");
  const tNetwork = await getTranslations("network");

  const networks = ((memberships ?? []) as unknown as MembershipRow[])
    .map((m) => m.network)
    .filter((n): n is NonNullable<MembershipRow["network"]> => n !== null);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl text-ink">{t("heading")}</h1>
      <div className="flex flex-col gap-3">
        {networks.map((network) => (
          <Link
            key={network.id}
            href={`/networks/${network.id}`}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
          >
            <span className="font-medium text-ink">{network.title}</span>
            <span className="text-sm text-muted">
              {tNetwork("memberPostCounts", { members: network.member_count, posts: network.post_count })}
            </span>
          </Link>
        ))}
        {networks.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted">{t("empty")}</p>
            <Link href="/search" className="text-sm font-medium text-primary hover:underline">
              {t("findNetworks")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
