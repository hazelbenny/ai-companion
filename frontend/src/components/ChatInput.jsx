import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const handleChange = (e) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900 p-2 shadow-lg focus-within:border-violet-500/50">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Say something..."
        className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-zinc-500"
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 transition disabled:opacity-30"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}