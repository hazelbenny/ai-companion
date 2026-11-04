import { useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  return (
    <button
      onClick={copy}
      title="Copy"
      className="mt-1 text-zinc-600 opacity-0 transition hover:text-zinc-300 group-hover:opacity-100"
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function MessageBubble({ message, typing }) {
  if (message.role === "user") {
    return (
      <div className="fade-up flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2.5 text-[15px]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up group flex gap-3">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs">
        ✦
      </div>
      <div
        className={`max-w-[85%] text-[15px] leading-relaxed ${
          message.error ? "text-red-300" : "text-zinc-200"
        }`}
      >
        {typing ? (
          <TypingDots />
        ) : (
          <>
            <div className="md">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            {!message.error && message.content && <CopyButton text={message.content} />}
          </>
        )}
      </div>
    </div>
  );
}