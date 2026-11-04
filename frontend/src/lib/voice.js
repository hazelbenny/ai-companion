import { useEffect, useRef, useState } from "react";

const Recognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const speechOutputSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

/* ---------- Speech to text ---------- */

export function useSpeechInput(onResult) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);

  const start = () => {
    if (!Recognition || recRef.current) return;
    const rec = new Recognition();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true; // show words while you are still speaking
    rec.continuous = false;

    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      onResult(text);
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") setError(e.error);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    setError("");
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => recRef.current?.stop(); // finishes the current phrase
  const cancel = () => recRef.current?.abort(); // discards anything pending

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported: Boolean(Recognition), listening, error, start, stop, cancel };
}

/* ---------- Text to speech ---------- */

// Remove markdown symbols and emoji so they aren't read out loud
export function cleanForSpeech(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text, onEnd) {
  if (!speechOutputSupported) return;
  const clean = cleanForSpeech(text);
  window.speechSynthesis.cancel();
  if (!clean) return;
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechOutputSupported) window.speechSynthesis.cancel();
}