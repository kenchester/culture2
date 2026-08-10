import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type NetworkRow = {
  id: number;
  title: string;
  member_count: number;
  post_count: number;
  language: { name: string } | null;
  origin_place: { name: string } | null;
  location: { name: string } | null;
};

export default async function AdminTrendingPage() {
  const supabase = await createClient();

  const { data: networks } = (await supabase
    .from("networks")
    .select(
      "id, title, member_count, post_count, language:language_id(name), origin_place:origin_place_id(name), location:location_place_id(name)",
    )
    .order("member_count", { ascending: false })
    .limit(20)) as unknown as { data: NetworkRow[] | null };

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm text-muted">Top 20 networks by member count.</p>
      <div className="flex flex-col">
        {networks?.map((network, index) => {
          const origin = network.language?.name ?? network.origin_place?.name ?? "?";
          return (
            <Link
              key={network.id}
              href={`/networks/${network.id}`}
              target="_blank"
              className="flex items-center gap-4 border-b border-border py-3 hover:bg-primary-light"
            >
              <span className="w-6 shrink-0 text-right text-sm text-muted">{index + 1}</span>
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
        {networks?.length === 0 && <p className="text-sm text-muted">No networks yet.</p>}
      </div>
    </div>
  );
}
