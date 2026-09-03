import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getGeoName } from "@/lib/geo-translation";
import { getPostMediaUrl } from "@/lib/post-media";
import { buildSubdomainUrl, getMainSiteUrl, isLearnHost } from "@/lib/site-url";
import { demoPostTimestamp, isExampleNetwork } from "@/lib/demo-network";
import type { Locale } from "@/lib/locale";
import { createPost, joinNetwork, leaveNetwork, setNetworkPrompt } from "@/app/networks/actions";
import { EditableEntry } from "@/app/networks/editable-entry";
import { DemoNetworkFeed, type RealDemoPost } from "@/app/networks/[id]/demo-network-feed";
import { InviteFriendsBox } from "@/app/networks/[id]/invite-friends-box";
import { PostComposer } from "@/app/networks/[id]/post-composer";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-error";

// Below this, a network's activity is too thin to be worth suggesting -
// checked live against real data (32 networks total, median member count 1)
// before picking these, so today nothing on the main site clears the bar
// and the widget simply renders nothing rather than linking to a ghost town.
const MIN_SUGGESTED_MEMBERS = 10;
const MIN_SUGGESTED_POSTS = 5;

type SuggestedNetworkRow = {
  network_id: number;
  network_title: string;
  location_place_id: number;
  location_name: string;
  location_type: "country" | "region" | "city";
  member_count: number;
  post_count: number;
};

// Only for org-gated networks (Acme's and any future school's) - a learner
// stuck in a small, closed community might want real native/heritage
// speakers too, and the main site already has public networks organized by
// language + location for exactly that. Reuses search_networks (the same
// RPC the main site's own search results page calls) rather than
// reimplementing the places-hierarchy "nearby" matching it already does.
async function getSuggestedSpeakerNetwork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  network: { id: number; language_id: number | null },
) {
  if (!network.language_id) {
    return null;
  }

  const { data: gatedEntry } = await supabase
    .from("organization_languages")
    .select("organization:organizations(location_place_id)")
    .eq("network_id", network.id)
    .maybeSingle();
  const orgLocationId = (gatedEntry?.organization as unknown as { location_place_id: number } | null)
    ?.location_place_id;

  if (!orgLocationId) {
    return null;
  }

  const [{ data: gatedNetworkIds }, { data: candidates }] = await Promise.all([
    supabase.from("organization_languages").select("network_id"),
    supabase.rpc("search_networks", {
      p_language_id: network.language_id,
      p_origin_place_id: null,
      p_religion_id: null,
      p_location_place_id: orgLocationId,
    }),
  ]);

  const excludedIds = new Set((gatedNetworkIds ?? []).map((row) => row.network_id));
  excludedIds.add(network.id);

  const best = ((candidates ?? []) as SuggestedNetworkRow[]).find(
    (row) =>
      !excludedIds.has(row.network_id) &&
      row.member_count >= MIN_SUGGESTED_MEMBERS &&
      row.post_count >= MIN_SUGGESTED_POSTS,
  );

  return best ?? null;
}

export default async function NetworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    embed?: string;
    invited?: string;
    inviteError?: string;
  }>;
}) {
  const { id } = await params;
  const { error, embed, invited, inviteError } = await searchParams;
  const isEmbedded = embed === "1";
  const supabase = await createClient();
  const t = await getTranslations("network");
  const locale = (await getLocale()) as Locale;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: network } = await supabase
    .from("networks")
    .select(
      "id, title, member_count, post_count, language_id, origin_place_id, religion_id, location_place_id, instructor_prompt",
    )
    .eq("id", id)
    .single();

  if (!network) {
    notFound();
  }

  const { data: location } = await supabase
    .from("places")
    .select("id, name, type, iso_code")
    .eq("id", network.location_place_id)
    .single();

  // A campus-anchored network only ever exists because it was launched
  // from within learn.culturemesh.com (see 00000000000058_campus_place_
  // type.sql), so it should always resolve under that host - and,
  // symmetrically, every other network should never end up canonically
  // hosted there. Without this, a network's host is just an accident of
  // whichever page someone happened to launch or link it from: "Search"
  // is reachable from within a learn-hosted school page too (finding real
  // native speakers - see getSuggestedSpeakerNetwork below), and its
  // launch action (app/search/actions.ts) redirects with a plain relative
  // path, so a public India-in-Michigan network launched from there would
  // otherwise permanently keep a learn.culturemesh.com URL for a network
  // that has nothing to do with any school. Skipped for embeds (an iframe
  // shouldn't be redirected out from under its parent page) and locally
  // (no real subdomain to redirect to - buildSubdomainUrl's own localhost
  // fallback would otherwise send this right back to the same URL and
  // loop).
  const mainSiteUrl = await getMainSiteUrl();
  const belongsUnderLearn = location?.type === "campus";
  const isLocalDev = mainSiteUrl.includes("localhost") || mainSiteUrl.includes("127.0.0.1");
  if (!isEmbedded && !isLocalDev && belongsUnderLearn !== (await isLearnHost())) {
    const params = new URLSearchParams();
    if (error) params.set("error", error);
    if (invited) params.set("invited", invited);
    if (inviteError) params.set("inviteError", inviteError);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const target = belongsUnderLearn
      ? buildSubdomainUrl(mainSiteUrl, "learn", `/networks/${network.id}${query}`)
      : `${mainSiteUrl}/networks/${network.id}${query}`;
    redirect(target);
  }

  const [
    { data: language },
    { data: originPlace },
    { data: religion },
    { data: membership },
    { data: posts },
    { data: myLikes },
    { data: canManagePrompt },
    suggestedNetwork,
    isExample,
  ] = await Promise.all([
    network.language_id
      ? supabase.from("languages").select("id, name, iso_code").eq("id", network.language_id).single()
      : Promise.resolve({ data: null }),
    network.origin_place_id
      ? supabase
          .from("places")
          .select("id, name, type, iso_code")
          .eq("id", network.origin_place_id)
          .single()
      : Promise.resolve({ data: null }),
    network.religion_id
      ? supabase.from("religions").select("name").eq("id", network.religion_id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("network_members")
          .select("user_id")
          .eq("network_id", network.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("posts")
      .select(
        "id, body, video_url, media_type, media_path, created_at, author:user_id(id, username, first_name, last_name, img_path), post_replies(count), likes(count)",
      )
      .eq("network_id", network.id)
      .order("created_at", { ascending: false }),
    user
      ? supabase.from("likes").select("post_id").eq("user_id", user.id).not("post_id", "is", null)
      : Promise.resolve({ data: null }),
    user
      ? supabase.rpc("can_manage_network_prompt", { p_network_id: network.id })
      : Promise.resolve({ data: false }),
    getSuggestedSpeakerNetwork(supabase, network),
    isExampleNetwork(supabase, network.location_place_id),
  ]);

  const [translatedLanguageName, translatedOriginName, translatedLocationName, translatedSuggestedLocationName] =
    await Promise.all([
      language
        ? getGeoName("language", language.id, language.name, locale, { isoCode: language.iso_code })
        : Promise.resolve(null),
      originPlace
        ? getGeoName("place", originPlace.id, originPlace.name, locale, {
            isoCode: originPlace.iso_code,
            placeType: originPlace.type,
          })
        : Promise.resolve(null),
      location
        ? getGeoName("place", location.id, location.name, locale, {
            isoCode: location.iso_code,
            placeType: location.type,
          })
        : Promise.resolve(null),
      suggestedNetwork
        ? getGeoName("place", suggestedNetwork.location_place_id, suggestedNetwork.location_name, locale, {
            placeType: suggestedNetwork.location_type,
          })
        : Promise.resolve(null),
    ]);

  // A campus-type location (00000000000058_campus_place_type.sql) only
  // ever belongs to one org, and every one of that org's networks shares
  // the exact same location_place_id - so this is enough to find "the"
  // school a network belongs to, with no join table needed. Deliberately
  // scoped to campus locations only: a public network anchored to a real
  // city/region/country has no such school to link back to.
  const { data: gatingOrgForLocation } =
    location?.type === "campus"
      ? await supabase.from("organizations").select("slug").eq("location_place_id", location.id).maybeSingle()
      : { data: null };

  const originName = translatedLanguageName ?? translatedOriginName ?? religion?.name ?? "?";
  const isMember = Boolean(membership);
  const myLikedPostIds = new Set((myLikes ?? []).map((l) => l.post_id as number));

  // Signed URLs (post-media is a private bucket, 00000000000065) are
  // resolved for every post up front, in parallel, rather than per-row
  // during render - matches how avatarUrl is already computed once per
  // post below, just now async.
  const postMediaUrls = new Map(
    await Promise.all(
      (posts ?? []).map(async (post) => [post.id, await getPostMediaUrl(post.media_path)] as const),
    ),
  );

  const returnTo = `/networks/${network.id}${isEmbedded ? "?embed=1" : ""}`;
  const signInParams = new URLSearchParams({ returnTo });
  if (isEmbedded) signInParams.set("embed", "1");
  const signInHref = `/sign-in?${signInParams.toString()}`;

  // Acme's ephemeral demo mode (DemoNetworkFeed) needs these as a plain
  // serializable array rather than JSX - same per-post values the real
  // .map() below computes inline, just built once up front so both the
  // demo and real render paths can share this one pass over `posts`.
  const embedSuffix = isEmbedded ? "?embed=1" : "";
  const realDemoPosts: RealDemoPost[] = isExample
    ? (posts ?? []).map((post, postIndex) => {
        const author = post.author as unknown as Author | null;
        const avatarUrl = author ? getAvatarUrl(supabase, author.img_path) : null;
        const replyCount =
          (post.post_replies as unknown as { count: number } | { count: number }[] | null) ?? { count: 0 };
        const replyCountValue = Array.isArray(replyCount) ? (replyCount[0]?.count ?? 0) : replyCount.count;
        return {
          id: post.id,
          body: post.body,
          media:
            post.media_type && postMediaUrls.get(post.id)
              ? { type: post.media_type as "audio" | "video", url: postMediaUrls.get(post.id)! }
              : null,
          videoUrl: post.video_url,
          createdAt: demoPostTimestamp(postIndex, (posts ?? []).length, true),
          authorName: author ? getDisplayName(author) : t("someone"),
          authorHref: author ? `/profile/${author.id}` : "#",
          avatarUrl,
          replyHref: `/networks/${network.id}/posts/${post.id}${embedSuffix}`,
          replyCountLabel:
            replyCountValue === 0
              ? t("replyLabel.zero")
              : replyCountValue === 1
                ? t("replyLabel.one")
                : t("replyLabel.other", { count: replyCountValue }),
        };
      })
    : [];

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 gap-8 px-4 py-12 lg:grid-cols-[1fr_18rem]">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl text-ink">{network.title}</h1>
          <p className="text-sm text-muted">
            {gatingOrgForLocation ? (
              t.rich("originInLinked", {
                origin: originName,
                location: translatedLocationName ?? "?",
                loc: (chunks) => (
                  <Link href={`/learn/${gatingOrgForLocation.slug}`} className="text-primary hover:underline">
                    {chunks}
                  </Link>
                ),
              })
            ) : (
              t("originIn", { origin: originName, location: translatedLocationName ?? "?" })
            )}
          </p>
        </div>

        <p className="text-sm text-muted">
          {t("memberPostCounts", { members: network.member_count, posts: network.post_count })}
          <Link
            href={`/networks/${network.id}/events${isEmbedded ? "?embed=1" : ""}`}
            className="ml-3 font-medium text-primary hover:underline"
          >
            {t("events")}
          </Link>
        </p>

        {isExample ? (
          <DemoNetworkFeed
            networkId={network.id}
            realPrompt={network.instructor_prompt}
            realPosts={realDemoPosts}
          />
        ) : (
          <>
            {(network.instructor_prompt || canManagePrompt) && (
              <div className="flex flex-col gap-2 rounded-md border border-primary bg-primary-light p-3">
                {network.instructor_prompt && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {t("weeklyPrompt")}
                    </p>
                    <p className="text-sm text-body">{network.instructor_prompt}</p>
                  </div>
                )}
                {canManagePrompt && (
                  <form action={setNetworkPrompt} className="flex flex-col gap-2">
                    <input type="hidden" name="networkId" value={network.id} />
                    {isEmbedded && <input type="hidden" name="embed" value="1" />}
                    <Field>
                      <Label htmlFor="prompt">{t("weeklyPromptEditLabel")}</Label>
                      <Textarea
                        id="prompt"
                        name="prompt"
                        defaultValue={network.instructor_prompt ?? ""}
                        placeholder={t("weeklyPromptPlaceholder")}
                        rows={2}
                      />
                    </Field>
                    <Button type="submit" variant="secondary" className="self-start">
                      {t("weeklyPromptSave")}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {user ? (
              <form action={isMember ? leaveNetwork : joinNetwork}>
                <input type="hidden" name="networkId" value={network.id} />
                {isEmbedded && <input type="hidden" name="embed" value="1" />}
                <Button type="submit">{isMember ? t("leaveNetwork") : t("joinNetwork")}</Button>
              </form>
            ) : (
              <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
                {t("signInToJoin")}
              </Link>
            )}

            <div className="flex flex-col gap-4 border-t border-border pt-6">
              {isMember && (
                <form action={createPost} className="flex flex-col gap-2">
                  <input type="hidden" name="networkId" value={network.id} />
                  {isEmbedded && <input type="hidden" name="embed" value="1" />}
                  {error && (
                    <FormError>{error}</FormError>
                  )}
                  <PostComposer
                    idPrefix="post"
                    bodyLabel={t("postLabel")}
                    bodyPlaceholder={t("postPlaceholder")}
                    submitLabel={t("postSubmit")}
                  />
                </form>
              )}

              <div className="flex flex-col gap-4">
                {posts?.map((post) => {
                  const author = post.author as unknown as Author | null;
                  const avatarUrl = author ? getAvatarUrl(supabase, author.img_path) : null;
                  const replyCount =
                    (post.post_replies as unknown as
                      | { count: number }
                      | { count: number }[]
                      | null) ?? { count: 0 };
                  const replyCountValue = Array.isArray(replyCount)
                    ? (replyCount[0]?.count ?? 0)
                    : replyCount.count;
                  const likeCount =
                    (post.likes as unknown as { count: number } | { count: number }[] | null) ?? {
                      count: 0,
                    };
                  const likeCountValue = Array.isArray(likeCount)
                    ? (likeCount[0]?.count ?? 0)
                    : likeCount.count;

                  return (
                    <div key={post.id} className="flex gap-3 border-b border-border pb-4">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-border" />
                      )}
                      <div className="flex flex-1 flex-col gap-1">
                        <Link
                          href={author ? `/profile/${author.id}` : "#"}
                          className="text-sm font-medium text-ink underline hover:text-primary"
                        >
                          {author ? getDisplayName(author) : t("someone")}
                        </Link>
                        <EditableEntry
                          kind="post"
                          itemId={post.id}
                          body={post.body}
                          media={
                            post.media_type && postMediaUrls.get(post.id)
                              ? { type: post.media_type as "audio" | "video", url: postMediaUrls.get(post.id)! }
                              : null
                          }
                          createdAt={post.created_at}
                          canModify={user?.id === author?.id}
                          likeCount={likeCountValue}
                          liked={myLikedPostIds.has(post.id)}
                        />
                        {post.video_url && (
                          <a
                            href={post.video_url}
                            className="text-sm text-primary underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {post.video_url}
                          </a>
                        )}
                        <Link
                          href={`/networks/${network.id}/posts/${post.id}${isEmbedded ? "?embed=1" : ""}`}
                          className="text-sm text-muted underline hover:text-primary"
                        >
                          {replyCountValue === 0
                            ? t("replyLabel.zero")
                            : replyCountValue === 1
                              ? t("replyLabel.one")
                              : t("replyLabel.other", { count: replyCountValue })}
                        </Link>
                      </div>
                    </div>
                  );
                })}
                {posts?.length === 0 && <p className="text-sm text-muted">{t("noPostsYet")}</p>}
              </div>
            </div>
          </>
        )}
      </div>

      {!isEmbedded && (user || suggestedNetwork) && (
        <aside className="flex flex-col gap-4">
          {user && (
            <InviteFriendsBox
              networkId={network.id}
              invited={invited === "1"}
              inviteError={inviteError}
            />
          )}
          {suggestedNetwork && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <h2 className="font-medium text-ink">
                {t("connectWithSpeakersHeading", { language: translatedLanguageName ?? "?" })}
              </h2>
              <p className="text-sm text-muted">
                {t("connectWithSpeakersIntro", { location: translatedSuggestedLocationName ?? "?" })}
              </p>
              <Link
                href={`/networks/${suggestedNetwork.network_id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {suggestedNetwork.network_title}
              </Link>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
