import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinNetwork, leaveNetwork } from "@/app/networks/actions";

export default async function NetworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: network } = await supabase
    .from("networks")
    .select(
      "id, title, member_count, post_count, language_id, origin_place_id, location_place_id",
    )
    .eq("id", id)
    .single();

  if (!network) {
    notFound();
  }

  const [{ data: language }, { data: originPlace }, { data: location }, { data: membership }] =
    await Promise.all([
      network.language_id
        ? supabase.from("languages").select("name").eq("id", network.language_id).single()
        : Promise.resolve({ data: null }),
      network.origin_place_id
        ? supabase.from("places").select("name").eq("id", network.origin_place_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("places").select("name, type").eq("id", network.location_place_id).single(),
      user
        ? supabase
            .from("network_members")
            .select("user_id")
            .eq("network_id", network.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const originName = language?.name ?? originPlace?.name ?? "?";
  const isMember = Boolean(membership);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">{network.title}</h1>
        <p className="text-sm text-zinc-600">
          {originName} in {location?.name ?? "?"}
        </p>
      </div>

      <p className="text-sm text-zinc-600">
        {network.member_count} members, {network.post_count} posts
      </p>

      {user ? (
        <form action={isMember ? leaveNetwork : joinNetwork}>
          <input type="hidden" name="networkId" value={network.id} />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            {isMember ? "Leave network" : "Join network"}
          </button>
        </form>
      ) : (
        <a href="/sign-in" className="text-sm underline">
          Sign in to join
        </a>
      )}
    </div>
  );
}
