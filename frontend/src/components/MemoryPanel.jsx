import { useEffect, useState } from "react";
import { X, Trash2, Brain } from "lucide-react";
import * as db from "../lib/db";

export default function MemoryPanel({ onClose, enabled, onToggle, onClearChats }) {
  const [memories, setMemories] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    db.listMemories().then((list) => {
      if (!cancelled) setMemories(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = async (id) => {
    setMemories((ms) => ms.filter((m) => m.id !== id));
    await db.deleteMemory(id);
  };

  const removeAll = async () => {
    if (!window.confirm("Delete all memories? This can't be undone.")) return;
    setMemories([]);
    await db.deleteAllMemories();
  };

  const clearChats = async () => {
    if (!window.confirm("Delete ALL conversations? This can't be undone.")) return;
    await onClearChats();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
          <Brain size={18} className="text-violet-400" />
          <h2 className="font-semibold">Memory & privacy</h2>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4">
            <div className="flex-1">
              <p className="font-medium">Remember things about me</p>
              <p className="mt-1 text-sm text-zinc-500">
                When on, your companion saves lasting facts you share (interests, projects,
                goals) and uses them in later chats. It is told never to save sensitive details
                like health, finances or religion. When off, nothing is saved or used.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={() => onToggle(!enabled)}
              className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
                enabled ? "bg-violet-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  enabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <p className="mb-2 mt-7 text-xs uppercase tracking-wider text-zinc-500">
            What I remember {memories && `(${memories.length})`}
          </p>

          {memories === null && <p className="text-sm text-zinc-500">Loading...</p>}
          {memories?.length === 0 && (
            <p className="text-sm text-zinc-500">Nothing saved yet.</p>
          )}
          <ul className="space-y-2">
            {memories?.map((m) => (
              <li key={m.id} className="group flex items-start gap-3 rounded-xl border border-white/5 px-4 py-3">
                <span className="flex-1 text-sm text-zinc-300">{m.content}</span>
                <button
                  onClick={() => remove(m.id)}
                  title="Delete this memory"
                  className="mt-0.5 text-zinc-600 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-white/5 p-5">
          <button
            onClick={removeAll}
            disabled={!memories?.length}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm transition hover:bg-white/5 disabled:opacity-30"
          >
            Delete all memories
          </button>
          <button
            onClick={clearChats}
            className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"
          >
            Delete all conversations
          </button>
        </div>
      </div>
    </div>
  );
}