import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

type NetworkRow = {
  id: number;
  title: string;
  member_count: number;
  post_count: number;
  language: { name: string } | null;
  origin_place: { name: string } | null;
  religion: { name: string } | null;
  location: { name: string } | null;
};

export default async function AdminTrendingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: networks, count } = (await supabase
    .from("networks")
    .select(
      "id, title, member_count, post_count, language:language_id(name), origin_place:origin_place_id(name), religion:religion_id(name), location:location_place_id(name)",
      { count: "exact" },
    )
    .order("member_count", { ascending: false })
    .order("post_count", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)) as unknown as {
    data: NetworkRow[] | null;
    count: number | null;
  };

  const total = count ?? 0;
  const hasPrev = page > 1;
  const hasNext = offset + PAGE_SIZE < total;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm text-muted">
        {total === 0
          ? "No networks yet."
          : `Networks ${rangeStart}–${rangeEnd} of ${total}, ranked by member count.`}
      </p>
      <div className="flex flex-col">
        {networks?.map((network, index) => {
          const origin =
            network.language?.name ?? network.origin_place?.name ?? network.religion?.name ?? "?";
          return (
            <Link
              key={network.id}
              href={`/networks/${network.id}`}
              target="_blank"
              className="flex items-center gap-4 border-b border-border py-3 hover:bg-primary-light"
            >
              <span className="w-8 shrink-0 text-right text-sm text-muted">
                {offset + index + 1}
              </span>
              <div className="flex flex-1 flex-col">
                <span className="font-medium text-ink">{network.title}</span>
                <span className="text-sm text-muted">
                  {origin} in {network.location?.name ?? "?"}
                </span>
              </div>
              <div className="shrink-0 text-right text-sm text-muted">
                <div>{network.member_count} members</div>
                <div>{network.post_count} posts</div>
              </div>
            </Link>
          );
        })}
      </div>
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-2">
          {hasPrev ? (
            <Link
              href={`/admin/trending?page=${page - 1}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              &larr; Previous 20
            </Link>
          ) : (
            <span className="text-sm text-muted">&larr; Previous 20</span>
          )}
          {hasNext ? (
            <Link
              href={`/admin/trending?page=${page + 1}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Next 20 &rarr;
            </Link>
          ) : (
            <span className="text-sm text-muted">Next 20 &rarr;</span>
          )}
        </div>
      )}
    </div>
  );
}
