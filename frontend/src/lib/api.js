import { supabase } from "./supabase";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function streamChat({ messages, personality, useMemory = true, onText, onError }) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, personality, use_memory: useMemory }),
  });
  if (!res.ok || !res.body) throw new Error("Server error");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop();

    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const data = event.slice(6);
      if (data === "[DONE]") return;
      const parsed = JSON.parse(data);
      if (parsed.error) onError?.(parsed.error);
      else onText(parsed.text);
    }
  }
}