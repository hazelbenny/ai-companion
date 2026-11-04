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

export async function listMemories() {
  const { data, error } = await supabase
    .from("memories")
    .select("id, content, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Database error:", error.message);
    return [];
  }
  return data;
}

export async function deleteMemory(id) {
  check(await supabase.from("memories").delete().eq("id", id));
}

export async function deleteAllMemories() {
  check(await supabase.from("memories").delete().not("id", "is", null));
}

export async function deleteAllConversations() {
  // messages are removed too, via "on delete cascade"
  check(await supabase.from("conversations").delete().not("id", "is", null));
}

export async function getMemoryEnabled() {
  const { data } = await supabase
    .from("user_settings")
    .select("memory_enabled")
    .maybeSingle();
  return data?.memory_enabled ?? true;
}

export async function setMemoryEnabled(userId, enabled) {
  check(
    await supabase
      .from("user_settings")
      .upsert({ user_id: userId, memory_enabled: enabled })
  );
}

export async function deleteAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;

  // Remove anything left in this browser, including chats cached by early versions
  Object.keys(localStorage)
    .filter((k) => k.startsWith("convos"))
    .forEach((k) => localStorage.removeItem(k));

  // The server-side session is already gone with the user; just clear the local one
  await supabase.auth.signOut({ scope: "local" });
}