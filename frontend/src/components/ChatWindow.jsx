import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { PERSONALITIES, SUGGESTIONS } from "../lib/personalities";

export default function ChatWindow({ convo, streaming, onSend, onPersonality, onMenu }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [convo.messages]);

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <button className="md:hidden" onClick={onMenu}><Menu size={20} /></button>
        <div className="flex gap-2 overflow-x-auto">
          {PERSONALITIES.map((p) => (
            <button
              key={p.id}
              onClick={() => onPersonality(p.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
                convo.personality === p.id
                  ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/50"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4">
        {convo.messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl">
              ✦
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Hey, what's on your mind?</h1>
            <p className="mt-2 text-zinc-500">Talk about anything. Pick a personality above.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5 py-6">
            {convo.messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                typing={streaming && i === convo.messages.length - 1 && m.role === "assistant" && m.content === ""}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        <ChatInput onSend={onSend} disabled={streaming} />
      </div>
    </main>
  );
}