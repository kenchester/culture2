import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { corridorSlug, idFromSlug, slugWithId } from "@/lib/slug";
import { recordPageView, viewPath } from "@/lib/page-views";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { type Author, getAvatarUrl, getDisplayName } from "@/lib/profiles";
import { getGeoName } from "@/lib/geo-translation";
import { getPostMediaUrl } from "@/lib/post-media";
import { getPlaceChain } from "@/lib/place-chain";
import {
  cursorOf,
  fetchRepliesForPosts,
  POSTS_PAGE_SIZE,
  POSTS_PREFETCH_MARGIN,
  toPostViews,
} from "@/lib/post-views";
import { buildSubdomainUrl, getMainSiteUrl, isLearnHost } from "@/lib/site-url";
import { demoPostTimestamp, isExampleNetwork } from "@/lib/demo-network";
import type { Locale } from "@/lib/locale";
import { createPost, joinNetwork, leaveNetwork, setNetworkPrompt } from "@/app/networks/actions";
import { DemoNetworkFeed, type RealDemoPost } from "@/app/networks/[id]/demo-network-feed";
import { InviteFriendsBox } from "@/app/networks/[id]/invite-friends-box";
import { CorridorContextBlock } from "@/app/networks/[id]/corridor-context-block";
import { getCorridorContext } from "@/lib/corridor-context";
import { PostComposer } from "@/app/networks/[id]/post-composer";
import { PostFeed } from "@/app/networks/[id]/post-feed";
import { PostingIndicator } from "@/components/posting-indicator";
import { Field, Label, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";

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

/**
 * A network link is the most-forwarded thing on the site, so it needs a
 * preview. Organisation networks are gated (00000000000078), so their
 * metadata stays generic and uncrawled: the title alone would disclose
 * which school a private network belongs to.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // The route accepts both the bare id and the readable slug that ends
  // in it (lib/slug.ts), so links shared before slugs existed still work.
  const networkId = idFromSlug(id);
  if (networkId === null) notFound();
  const t = await getTranslations("network");
  const supabase = await createClient();

  const { data: network } = await supabase
    .from("networks")
    .select("id, title, member_count, post_count, location_place_id")
    .eq("id", networkId)
    .maybeSingle();

  // An unreadable row here means missing; there is nothing to preview.
  if (!network) return {};

  // The title is not a secret - the page shows it to anonymous visitors
  // above the sign-in prompt, and a student following a shared link needs
  // the preview to look right. Being in a search index is a different
  // question: a network anchored on a place hidden from search belongs to
  // an organisation, and is already kept out of CultureMesh's own search,
  // so it should not be crawled either.
  const { data: place } = await supabase
    .from("places")
    .select("hidden_from_search")
    .eq("id", network.location_place_id as number)
    .maybeSingle();

  return shareMetadata({
    title: network.title as string,
    description: previewText(
      t("metaDescription", {
        members: (network.member_count as number) ?? 0,
        posts: (network.post_count as number) ?? 0,
      }),
    ),
    path: `/networks/${slugWithId(network.title as string, network.id as number)}`,
    noIndex: Boolean(place?.hidden_from_search),
  });
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
  // The route accepts both the bare id and the readable slug that ends
  // in it (lib/slug.ts), so links shared before slugs existed still work.
  const networkId = idFromSlug(id);
  if (networkId === null) notFound();
  const { error, embed, invited, inviteError } = await searchParams;
  const isEmbedded = embed === "1";
  const supabase = await createClient();
  const t = await getTranslations("network");
  const tCorridor = await getTranslations("corridor");
  recordPageView(viewPath("/networks", String(networkId)));
  const locale = (await getLocale()) as Locale;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: network } = await supabase
    .from("networks")
    .select(
      "id, title, member_count, post_count, language_id, origin_place_id, religion_id, location_place_id, instructor_prompt",
    )
    .eq("id", networkId)
    .single();

  if (!network) {
    notFound();
  }

  const { data: location } = await supabase
    .from("places")
    .select("id, name, type, iso_code")
    .eq("id", network.location_place_id)
    .single();

  // The same route, the other way round. Two people on opposite ends is
  // a working corridor; twenty in one city is not a prerequisite.
  const { data: reverseNetwork } = network.origin_place_id
    ? await supabase
        .from("networks")
        .select("id, title, member_count")
        .eq("origin_place_id", network.location_place_id)
        .eq("location_place_id", network.origin_place_id)
        .maybeSingle()
    : { data: null };

  // getCorridorContext returns null when there is nothing worth saying,
  // so every network can ask and only the ones with facts render a box.
  const corridorContext = await getCorridorContext(supabase, {
    origin_place_id: network.origin_place_id,
    location_place_id: network.location_place_id,
  });
  // Above the feed until a community exists, below it afterwards. Never
  // removed: one member is not a conversation, so the feed is not yet the
  // reason anybody is on this page.
  const contextLeads = (network.member_count ?? 0) < 2;

  // The Unofficial Consul, if and only if an election has produced one.
  //
  // Deliberately silent otherwise: no empty state, no "no consul yet", no
  // explanation. A member of a community that has never held an election
  // should never learn this system exists from this page, and the great
  // majority of networks never will.
  //
  // One query, not three. The first version walked principals -> outposts
  // -> outpost_officers sequentially, which cost about 1.5s of round trips
  // on every single network pageview to answer "no" - and this is already
  // the heaviest page on the site. Inner joins with nested filters get the
  // same answer in one trip. Skipped entirely for language-origin
  // networks, since the office only maps place to place.
  let consul: { outpostId: number; name: string } | null = null;
  if (network.origin_place_id) {
    const { data: officer } = await supabase
      .from("outpost_officers")
      .select(
        "term_ends_at, profile:user_id(first_name, last_name, username), outpost:outposts!inner(id, host_place_id, kind, principal:principals!inner(place_id))",
      )
      .eq("outpost.host_place_id", network.location_place_id)
      .eq("outpost.principal.place_id", network.origin_place_id)
      .eq("outpost.kind", "honorary")
      // The policy hides revoked officers; an expired term is excluded
      // here so a lapsed mandate stops being advertised.
      .or(`term_ends_at.is.null,term_ends_at.gt.${new Date().toISOString()}`)
      .order("appointed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const profile = officer?.profile as unknown as Author | null;
    const outpost = officer?.outpost as unknown as { id: number } | null;
    if (profile && outpost) {
      consul = { outpostId: outpost.id, name: getDisplayName(profile) };
    }
  }

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
      ? supabase
          .from("languages")
          .select("id, name, iso_code, is_signed")
          .eq("id", network.language_id)
          .single()
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
        "id, body, video_url, media_type, media_path, created_at, transcript, transcript_language, transcript_segments, summary_text, summary_language:languages!summary_language_id(iso_code), author:user_id(id, username, first_name, last_name, img_path), post_replies(count), likes(count)",
      )
      .eq("network_id", network.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(POSTS_PAGE_SIZE),
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

  // The h1 keeps the short form to stay on one line; the subtitle beneath
  // carries the disambiguating chain, for both ends of the pairing. A
  // language or religion origin has no geography to expand, so it falls
  // back to the plain name.
  const [originChain, locationChain] = await Promise.all([
    getPlaceChain(supabase, originPlace?.id ?? null, locale),
    getPlaceChain(supabase, location?.id ?? null, locale),
  ]);

  const originName = translatedLanguageName ?? translatedOriginName ?? religion?.name ?? "?";
  const originSubtitle = originChain ?? originName;
  const locationSubtitle = locationChain ?? translatedLocationName ?? "?";
  const isMember = Boolean(membership);

  // An org-gated network still renders its shell to a non-member - they
  // need somewhere to land and a way in - but the feed underneath is empty
  // because 00000000000078 filters every post out, not because nothing has
  // been posted. Saying "No posts yet" to a student who simply isn't signed
  // in is false, and the post count printed directly above it contradicts
  // it on the same screen.
  const { data: gatingOrg } = await supabase
    .from("organization_languages")
    .select("organization:organizations(is_example)")
    .eq("network_id", network.id)
    .maybeSingle();
  const isOrgGated = Boolean(
    gatingOrg && !(gatingOrg.organization as unknown as { is_example: boolean } | null)?.is_example,
  );
  const feedEmptyMessage = isOrgGated && !isMember ? t("signInToSeePosts") : undefined;
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

  // The first page is rendered on the server from the rows already fetched
  // above; PostFeed appends later pages through the loadMorePosts action.
  // Both go through the same mapper so the two halves of the list can't
  // drift apart.
  const feedReplies = await fetchRepliesForPosts(
    supabase,
    network.id,
    (posts ?? []).map((p) => p.id),
    user?.id ?? null,
  );

  const postViews = toPostViews(supabase, (posts ?? []) as unknown as Record<string, unknown>[], {
    viewerId: user?.id ?? null,
    likedPostIds: myLikedPostIds,
    mediaUrls: postMediaUrls,
    repliesByPost: feedReplies,
  });


  // Drives both hiding the Audio tab and offering the written-summary
  // panel - a signed language has no spoken form (see languages.is_signed,
  // 00000000000072).
  const isSignedLanguage = Boolean((language as { is_signed?: boolean } | null)?.is_signed);

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
          transcript: post.transcript,
          transcriptLanguage: post.transcript_language,
          hasCaptions: Boolean(post.transcript_segments),
          summary: post.summary_text
            ? {
                text: post.summary_text,
                language:
                  (post.summary_language as unknown as { iso_code: string | null } | null)
                    ?.iso_code ?? null,
              }
            : null,
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
                origin: originSubtitle,
                location: locationSubtitle,
                loc: (chunks) => (
                  <Link href={`/learn/${gatingOrgForLocation.slug}`} className="text-primary hover:underline">
                    {chunks}
                  </Link>
                ),
              })
            ) : (
              t("originIn", { origin: originSubtitle, location: locationSubtitle })
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

        {consul && (
          <p className="text-sm">
            <Link
              href={`/outposts/${consul.outpostId}`}
              className="font-medium text-primary hover:underline"
            >
              {t("consulLine", { name: consul.name })}
            </Link>
          </p>
        )}

        {network.origin_place_id && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="text-muted">{tCorridor("otherEndLabel")}</span>
            {reverseNetwork ? (
              <Link
                href={`/networks/${slugWithId(reverseNetwork.title as string, reverseNetwork.id as number)}`}
                className="text-primary underline"
              >
                {reverseNetwork.title as string}
              </Link>
            ) : (
              <span className="text-muted">{tCorridor("otherEndNone")}</span>
            )}
            <Link
              href={`/corridors/${corridorSlug(
                { id: network.origin_place_id, name: originSubtitle },
                { id: network.location_place_id, name: locationSubtitle },
              )}`}
              className="text-primary underline"
            >
              {tCorridor("corridorLink")}
            </Link>
          </div>
        )}

        {corridorContext && contextLeads && (
          <CorridorContextBlock
            context={corridorContext}
            cityPlaceId={network.location_place_id}
            isEmpty={(network.member_count ?? 0) === 0}
            heading={tCorridor("headingNetwork")}
          />
        )}

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
                    <SubmitButton variant="secondary" className="self-start">
                      {t("weeklyPromptSave")}
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}

            {user ? (
              <form action={isMember ? leaveNetwork : joinNetwork}>
                <input type="hidden" name="networkId" value={network.id} />
                {isEmbedded && <input type="hidden" name="embed" value="1" />}
                <SubmitButton>{isMember ? t("leaveNetwork") : t("joinNetwork")}</SubmitButton>
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
                    isSignedLanguage={isSignedLanguage}
                  />
                  <PostingIndicator />
                </form>
              )}

              <PostFeed
                networkId={network.id}
                initialPosts={postViews}
                initialCursor={cursorOf(postViews)}
                hasMore={postViews.length === POSTS_PAGE_SIZE}
                prefetchMargin={POSTS_PREFETCH_MARGIN}
                embedSuffix={isEmbedded ? "?embed=1" : ""}
                emptyMessage={feedEmptyMessage}
              />
            </div>
          </>
        )}

        {corridorContext && !contextLeads && (
          <CorridorContextBlock
            context={corridorContext}
            cityPlaceId={network.location_place_id}
            isEmpty={false}
            heading={tCorridor("headingNetwork")}
          />
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
