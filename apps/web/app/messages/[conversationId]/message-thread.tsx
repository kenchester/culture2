"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: number;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      body,
    });
    if (!error) {
      setBody("");
    }
    setSending(false);
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded px-3 py-2 ${
              m.sender_id === currentUserId
                ? "self-end bg-black text-white"
                : "self-start bg-zinc-100"
            }`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message..."
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded bg-black px-3 py-2 text-white"
        >
          Send
        </button>
      </form>
    </div>
  );
}
