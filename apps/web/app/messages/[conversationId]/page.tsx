import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/profiles";
import { MessageThread } from "@/app/messages/[conversationId]/message-thread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, user_a, user_b")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    notFound();
  }

  const otherUserId = conversation.user_a === user.id ? conversation.user_b : conversation.user_a;

  const [{ data: otherUser }, { data: messages }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, first_name, last_name")
      .eq("id", otherUserId)
      .single(),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
  ]);

  await supabase.from("conversation_reads").upsert({
    conversation_id: conversation.id,
    user_id: user.id,
    last_read_at: new Date().toISOString(),
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">
        {otherUser ? getDisplayName(otherUser) : "Conversation"}
      </h1>
      <MessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
