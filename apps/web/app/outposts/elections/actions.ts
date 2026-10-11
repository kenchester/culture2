"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every eligibility rule lives in the database functions
// (00000000000086), not here: who may open an election, who may stand, who
// may vote, and when. These actions only carry the call and surface the
// message, so a second copy of the rules can't drift from the first.
function errorBack(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function openElection(formData: FormData) {
  const networkId = Number(formData.get("networkId"));
  const supabase = await createClient();

  const { data: electionId, error } = await supabase.rpc("open_election", {
    p_network_id: networkId,
  });

  if (error) {
    errorBack("/outposts/elections", error.message);
  }
  revalidatePath("/outposts/elections");
  redirect(`/outposts/elections/${electionId}`);
}

export async function nominate(formData: FormData) {
  const electionId = Number(formData.get("electionId"));
  const statement = (formData.get("statement") as string) ?? "";
  const ties = (formData.get("ties") as string) ?? "";
  const path = `/outposts/elections/${electionId}`;
  const supabase = await createClient();

  const { error } = await supabase.rpc("nominate_for_election", {
    p_election_id: electionId,
    p_statement: statement,
    p_ties: ties,
  });

  if (error) {
    errorBack(path, error.message);
  }
  revalidatePath(path);
}

export async function castVote(formData: FormData) {
  const electionId = Number(formData.get("electionId"));
  const candidateId = Number(formData.get("candidateId"));
  // Only meaningful in a single-candidate confirmation vote.
  const support = formData.get("support") !== "no";
  const path = `/outposts/elections/${electionId}`;
  const supabase = await createClient();

  const { error } = await supabase.rpc("cast_election_vote", {
    p_election_id: electionId,
    p_candidate_id: candidateId,
    p_support: support,
  });

  if (error) {
    // The unique index is the real guard against double voting; this just
    // says so in words rather than showing a constraint name.
    errorBack(
      path,
      error.message.includes("election_votes_one_per_voter")
        ? "You have already voted in this election."
        : error.message,
    );
  }
  revalidatePath(path);
}
