import "server-only";

// A school's registered domain (e.g. "grcc.edu") should also recognize
// subdomain addresses like student@email.grcc.edu, not just an exact
// match - large schools commonly route students through a subdomain while
// staff/faculty keep the bare domain. Returns every domain that should be
// treated as "this school" for a given email domain: itself, plus each
// parent suffix. Stops one label short of the bare TLD (".edu" alone) so a
// match always requires a real second-level domain, never just a shared
// top-level domain.
export function domainMatchCandidates(emailDomain: string): string[] {
  const labels = emailDomain.split(".");
  const candidates: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) {
    candidates.push(labels.slice(i).join("."));
  }
  return candidates;
}
