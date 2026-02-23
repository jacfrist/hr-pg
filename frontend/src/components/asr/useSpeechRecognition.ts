import { useEffect, useRef, useState } from "react";

type SpeechState = {
  isSupported: boolean;
  isListening: boolean;
  interim: string;
  finalText: string;
  error: string | null;
};

export function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null);
  const [state, setState] = useState<SpeechState>({
    isSupported: true,
    isListening: false,
    interim: "",
    finalText: "",
    error: null,
  });

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState((s) => ({ ...s, isSupported: false }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;       // keep listening
    recognition.interimResults = true;   // get live partial text
    recognition.lang = "en-US";          // you can make this configurable

    recognition.onstart = () => {
      setState((s) => ({ ...s, isListening: true, error: null }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false, interim: "" }));
    };

    recognition.onerror = (e: any) => {
      setState((s) => ({ ...s, error: e?.error || "speech error" }));
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript;
        else interim += transcript;
      }

      setState((s) => ({
        ...s,
        interim,
        finalText: s.finalText + finalChunk,
      }));
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const start = () => {
    if (!recognitionRef.current) return;
    setState((s) => ({ ...s, finalText: "" }));
    recognitionRef.current.start();
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  };

  const reset = () => setState((s) => ({ ...s, interim: "", finalText: "" }));

  return { ...state, start, stop, reset };
}