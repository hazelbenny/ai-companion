import { supabase } from "./supabase";

function check({ error }) {
  if (error) console.error("Database error:", error.message);
}

export async function loadConversations() {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, personality, created_at, messages(role, content, created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((c) => ({
    id: c.id,
    title: c.title,
    personality: c.personality,
    messages: [...c.messages]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ role, content }) => ({ role, content })),
  }));
}

export async function createConversation(personality) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ personality })
    .select("id, title, personality")
    .single();
  if (error) throw error;
  return { ...data, messages: [] };
}

export async function updateConversation(id, fields) {
  check(await supabase.from("conversations").update(fields).eq("id", id));
}

export async function deleteConversation(id) {
  check(await supabase.from("conversations").delete().eq("id", id));
}

export async function saveMessage(conversationId, role, content) {
  check(
    await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, role, content })
  );
}