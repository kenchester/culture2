import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

type NetworkRow = {
  network_id: number;
  title: string;
  member_count: number;
  post_count: number;
};

const NETWORKS_PER_PAGE = 10;

// Linked from the user dropdown (app/nav.tsx) - previously the only way
// back into a joined network was search or a bookmark. Sourced from
// list_my_networks (00000000000066_list_my_networks.sql), which orders by
// whichever is more recent between joining and launching a network - a
// network someone launched themselves belongs at the top too, not just
// ones joined the ordinary way. Same "fetch PAGE_SIZE+1, slice, check the
// extra row" pagination as app/admin/organizations/page.tsx, no separate
// count query.
export default async function MyNetworksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * NETWORKS_PER_PAGE;

  const { data: networksRaw } = (await supabase.rpc("list_my_networks", {
    p_limit: NETWORKS_PER_PAGE + 1,
    p_offset: from,
  })) as { data: NetworkRow[] | null };

  const hasNextPage = (networksRaw?.length ?? 0) > NETWORKS_PER_PAGE;
  const networks = (networksRaw ?? []).slice(0, NETWORKS_PER_PAGE);

  const t = await getTranslations("myNetworks");
  const tNetwork = await getTranslations("network");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl text-ink">{t("heading")}</h1>
      <div className="flex flex-col gap-3">
        {networks.map((network) => (
          <Link
            key={network.network_id}
            href={`/networks/${network.network_id}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
          >
            <span className="font-medium text-ink">{network.title}</span>
            <span className="text-sm text-muted">
              {tNetwork("memberPostCounts", { members: network.member_count, posts: network.post_count })}
            </span>
          </Link>
        ))}
        {networks.length === 0 && currentPage === 1 && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted">{t("empty")}</p>
            <Link href="/search" className="text-sm font-medium text-primary hover:underline">
              {t("findNetworks")}
            </Link>
          </div>
        )}
        {(currentPage > 1 || hasNextPage) && (
          <div className="flex items-center justify-between pt-2">
            {currentPage > 1 ? (
              <Link
                href={`/my-networks?page=${currentPage - 1}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("previousPage")}
              </Link>
            ) : (
              <span />
            )}
            {hasNextPage && (
              <Link
                href={`/my-networks?page=${currentPage + 1}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("nextPage")}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
