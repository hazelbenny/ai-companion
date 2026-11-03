import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { streamChat } from "./lib/api";

const newConvo = (personality = "friend") => ({
  id: crypto.randomUUID(),
  title: "New chat",
  personality,
  messages: [],
});

export default function App() {
  const [convos, setConvos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("convos"));
      if (saved?.length) return saved;
    } catch {}
    return [newConvo()];
  });
  const [activeId, setActiveId] = useState(() => convos[0].id);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const active = convos.find((c) => c.id === activeId) ?? convos[0];

  // temporary persistence; replaced by the database in Step 3
  useEffect(() => {
    localStorage.setItem("convos", JSON.stringify(convos));
  }, [convos]);

  const update = (id, fn) =>
    setConvos((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const updateLast = (id, fn) =>
    update(id, (c) => {
      const msgs = [...c.messages];
      msgs[msgs.length - 1] = fn(msgs[msgs.length - 1]);
      return { ...c, messages: msgs };
    });

  const send = async (text) => {
    if (streaming) return;
    const id = active.id;
    const personality = active.personality;
    const history = [
      ...active.messages.filter((m) => !m.error),
      { role: "user", content: text },
    ];

    update(id, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
      messages: [...c.messages, { role: "user", content: text }, { role: "assistant", content: "" }],
    }));
    setStreaming(true);

    const fail = () =>
      updateLast(id, () => ({
        role: "assistant",
        error: true,
        content: "Something went wrong reaching the AI. Please try again in a moment.",
      }));

    try {
      await streamChat({
        messages: history,
        personality,
        onText: (t) => updateLast(id, (m) => ({ ...m, content: m.content + t })),
        onError: fail,
      });
    } catch {
      fail();
    } finally {
      setStreaming(false);
    }
  };

  const newChat = () => {
    const c = newConvo(active.personality);
    setConvos((cs) => [c, ...cs]);
    setActiveId(c.id);
    setSidebarOpen(false);
  };

  const deleteChat = (id) => {
    const rest = convos.filter((c) => c.id !== id);
    if (rest.length === 0) {
      const c = newConvo();
      setConvos([c]);
      setActiveId(c.id);
      return;
    }
    setConvos(rest);
    if (id === activeId) setActiveId(rest[0].id);
  };

  return (
    <div className="flex h-dvh">
      <Sidebar
        convos={convos}
        activeId={active.id}
        onSelect={(id) => { setActiveId(id); setSidebarOpen(false); }}
        onNew={newChat}
        onDelete={deleteChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <ChatWindow
        convo={active}
        streaming={streaming}
        onSend={send}
        onPersonality={(p) => update(active.id, (c) => ({ ...c, personality: p }))}
        onMenu={() => setSidebarOpen(true)}
      />
    </div>
  );
}