export default async function EmbedPage({
  params,
}: {
  params: Promise<{ partnerSlug: string }>;
}) {
  const { partnerSlug } = await params;
  return <div>Embed for {partnerSlug}</div>;
}
