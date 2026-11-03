import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import AuthScreen from "./components/AuthScreen";
import Chat from "./Chat";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="grid h-dvh place-items-center text-zinc-500">Loading...</div>;
  }
  if (!session) return <AuthScreen />;
  return (
  <ErrorBoundary>
    <Chat user={session.user} />
  </ErrorBoundary>
  );
}