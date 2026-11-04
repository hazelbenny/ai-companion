import { useState } from "react";
import { Copy, Check, Volume2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { speak, stopSpeaking, speechOutputSupported } from "../lib/voice";

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
    <button onClick={copy} title="Copy" className="text-zinc-600 transition hover:text-zinc-300">
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function SpeakButton({ text }) {
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    speak(text, () => setPlaying(false));
  };

  return (
    <button
      onClick={toggle}
      title={playing ? "Stop" : "Read aloud"}
      className={`transition hover:text-zinc-300 ${playing ? "text-violet-400" : "text-zinc-600"}`}
    >
      {playing ? <Square size={14} /> : <Volume2 size={14} />}
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
            {!message.error && message.content && (
              <div className="mt-1 flex gap-3 opacity-0 transition group-hover:opacity-100">
                <CopyButton text={message.content} />
                {speechOutputSupported && <SpeakButton text={message.content} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}