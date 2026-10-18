/**
 * Whether one place sits inside another, given its ancestor chain.
 *
 * Its own module, with no "server-only", so it can be tested directly -
 * the same reason lib/feed-replies.ts is separate.
 *
 * The rule looks trivial and is the exact spot a real bug lived. Testing
 * a partner against the other end's ANCESTORS rather than against the end
 * itself means two places that merely share a country match: New York is
 * twinned with Beijing, and that registered as a sister-city tie to
 * Fujian. Beijing is in China, Fujian is in China, Beijing is not in
 * Fujian.
 */
export function partnerIsInside(partnerChain: number[], endPlaceId: number): boolean {
  return partnerChain.includes(endPlaceId);
}
