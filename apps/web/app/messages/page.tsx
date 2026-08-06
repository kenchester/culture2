import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/profiles";

type ConversationRow = {
  conversation_id: number;
  other_user_id: string;
  other_username: string | null;
  other_first_name: string | null;
  other_last_name: string | null;
  other_img_path: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: conversations } = (await supabase.rpc("list_conversations")) as {
    data: ConversationRow[] | null;
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <div className="flex flex-col gap-3">
        {conversations?.map((c) => {
          const avatarUrl = getAvatarUrl(supabase, c.other_img_path);
          const displayName = getDisplayName({
            username: c.other_username,
            first_name: c.other_first_name,
            last_name: c.other_last_name,
          });

          return (
            <Link
              key={c.conversation_id}
              href={`/messages/${c.conversation_id}`}
              className="flex items-center gap-3 border-b pb-3"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{displayName}</p>
                {c.last_message_body && (
                  <p className="truncate text-sm text-zinc-600">{c.last_message_body}</p>
                )}
              </div>
              {c.unread_count > 0 && (
                <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-xs text-white">
                  {c.unread_count}
                </span>
              )}
            </Link>
          );
        })}
        {conversations?.length === 0 && (
          <p className="text-sm text-zinc-500">No conversations yet.</p>
        )}
      </div>
    </div>
  );
}
