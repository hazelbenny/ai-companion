import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { useSpeechInput } from "../lib/voice";

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const ref = useRef(null);
  const baseRef = useRef(""); // whatever was typed before dictation started

  const { supported, listening, error, start, stop, cancel } = useSpeechInput((spoken) =>
    setText(baseRef.current + spoken)
  );

  // auto-grow the textarea whenever the text changes (typed or dictated)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  const submit = () => {
    if (!text.trim() || disabled) return;
    cancel();
    onSend(text.trim());
    setText("");
  };

  const toggleMic = () => {
    if (listening) {
      stop();
      return;
    }
    baseRef.current = text ? text.trimEnd() + " " : "";
    start();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const hints = {
    "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
    "service-not-allowed":
      "Speech recognition is turned off. On a Mac, enable Dictation in System Settings → Keyboard.",
    "audio-capture": "No microphone was found.",
    network: "The speech service couldn't be reached. Check your connection.",
  };
  const hint = error ? (hints[error] ?? `Voice input error: ${error}`) : "";

  return (
    <div className="mx-auto w-full max-w-3xl">
      {hint && <p className="mb-2 px-2 text-xs text-red-400">{hint}</p>}
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900 p-2 shadow-lg focus-within:border-violet-500/50">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Listening..." : "Say something..."}
          className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-zinc-500"
        />
        {supported && (
          <button
            onClick={toggleMic}
            title={listening ? "Stop listening" : "Speak"}
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${
              listening
                ? "animate-pulse bg-red-500/80 text-white"
                : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            }`}
          >
            <Mic size={18} />
          </button>
        )}
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 transition disabled:opacity-30"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}