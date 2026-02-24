import { useEffect, useMemo, useRef, useState } from "react";

type SpeechState = {
  isSupported: boolean;
  isListening: boolean;
  interim: string;
  finalText: string;
  error: string | null;
};

/**
 * Minimal types so we don't rely on lib.dom SpeechRecognition typings,
 * which aren't always available.
 */
type MinimalSpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type MinimalSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<MinimalSpeechRecognitionResult>;
};

type MinimalSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((e: { error?: string }) => void);
  onresult: null | ((event: MinimalSpeechRecognitionEvent) => void);
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition() {
  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return getSpeechRecognitionCtor() !== null;
  }, []);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  const [state, setState] = useState<SpeechState>({
    isSupported: supported,
    isListening: false,
    interim: "",
    finalText: "",
    error: null,
  });

  useEffect(() => {
    if (!supported) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setState((s) => ({ ...s, isListening: true, error: null }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false, interim: "" }));
    };

    recognition.onerror = (e) => {
      setState((s) => ({ ...s, error: e?.error || "speech error" }));
    };

    recognition.onresult = (event) => {
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
      } catch (err) {
        void err;
      }
    };
  }, [supported]);

  const start = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setState((s) => ({ ...s, finalText: "" }));
    rec.start();
  };

  const stop = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.stop();
  };

  const reset = () => setState((s) => ({ ...s, interim: "", finalText: "" }));

  return { ...state, start, stop, reset };
}