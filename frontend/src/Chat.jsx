import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { streamChat } from "./lib/api";
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";

export default function Chat({ user }) {
  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list = await db.loadConversations();
        if (cancelled) return;
        if (list.length === 0) list = [await db.createConversation("friend")];
        if (cancelled) return;
        setConvos(list);
        setActiveId(list[0].id);
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoadError(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = convos.find((c) => c.id === activeId) ?? convos[0];

  const update = (id, fn) =>
    setConvos((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const updateLast = (id, fn) =>
    update(id, (c) => {
      const msgs = [...c.messages];
      msgs[msgs.length - 1] = fn(msgs[msgs.length - 1]);
      return { ...c, messages: msgs };
    });

  const send = async (text) => {
    if (streaming || !active) return;
    const { id, personality } = active;
    const isFirst = active.messages.length === 0;
    const title = text.slice(0, 40);
    const history = [
      ...active.messages.filter((m) => !m.error),
      { role: "user", content: text },
    ];

    update(id, (c) => ({
      ...c,
      title: isFirst ? title : c.title,
      messages: [
        ...c.messages,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ],
    }));
    setStreaming(true);

    await db.saveMessage(id, "user", text);
    if (isFirst) db.updateConversation(id, { title });

    let reply = "";
    let failed = false;
    const fail = () => {
      failed = true;
      updateLast(id, () => ({
        role: "assistant",
        error: true,
        content: "Something went wrong reaching the AI. Please try again in a moment.",
      }));
    };

    try {
      await streamChat({
        messages: history,
        personality,
        onText: (t) => {
          reply += t;
          updateLast(id, (m) => ({ ...m, content: m.content + t }));
        },
        onError: fail,
      });
    } catch {
      fail();
    }

    if (!failed && reply) await db.saveMessage(id, "assistant", reply);
    setStreaming(false);
  };

  const newChat = async () => {
    if (active.messages.length === 0) {
      setSidebarOpen(false); // already on an empty chat
      return;
    }
    try {
      const c = await db.createConversation(active.personality);
      setConvos((cs) => [c, ...cs]);
      setActiveId(c.id);
      setSidebarOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteChat = async (id) => {
    await db.deleteConversation(id);
    const rest = convos.filter((c) => c.id !== id);
    if (rest.length === 0) {
      const c = await db.createConversation("friend");
      setConvos([c]);
      setActiveId(c.id);
      return;
    }
    setConvos(rest);
    if (id === activeId) setActiveId(rest[0].id);
  };

  const changePersonality = (p) => {
    update(active.id, (c) => ({ ...c, personality: p }));
    db.updateConversation(active.id, { personality: p });
  };

  if (loading) {
    return <div className="grid h-dvh place-items-center text-zinc-500">Loading your chats...</div>;
  }
  if (loadError || !active) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center text-zinc-400">
        Couldn't load your conversations. Check the browser console for details.
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      <Sidebar
        convos={convos}
        activeId={active.id}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNew={newChat}
        onDelete={deleteChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        email={user.email}
        onSignOut={() => supabase.auth.signOut()}
      />
      <ChatWindow
        convo={active}
        streaming={streaming}
        onSend={send}
        onPersonality={changePersonality}
        onMenu={() => setSidebarOpen(true)}
      />
    </div>
  );
}