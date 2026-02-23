import React, { useEffect } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z"
      />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M8 8h8v8H8z" />
    </svg>
  );
}

export default function MicDictation({ value, onChange, disabled }: Props) {
  const {
    isSupported,
    isListening,
    interim,
    finalText,
    error,
    start,
    stop,
    reset,
  } = useSpeechRecognition();

  // Commit finalized chunks into the textarea (stable behavior).
  useEffect(() => {
    if (!finalText) return;
    const next = (value + " " + finalText).replace(/\s+/g, " ").trim();
    onChange(next);
    // Reset the hook's final buffer so we don't re-append on rerenders.
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalText]);

  const toggle = () => {
    if (disabled) return;
    if (!isListening) {
      reset();
      start();
    } else {
      stop();
    }
  };

  const clear = () => {
    if (disabled) return;
    onChange("");
    reset();
    if (isListening) stop();
  };

  if (!isSupported) {
    return (
      <div className="mb-3 text-purple-200">
        Live dictation isn’t supported in this browser. Try Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center gap-3">
      {/* Mic / Stop toggle */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`h-10 w-10 rounded-full flex items-center justify-center border transition
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}
          ${isListening ? "bg-red-600 border-red-500" : "bg-purple-700 border-purple-500"}
        `}
        aria-label={isListening ? "Stop recording" : "Start recording"}
        title={isListening ? "Stop" : "Record"}
      >
        <span className="text-white text-lg">
            {isListening ? (
                <StopIcon className="h-5 w-5 text-white" />
            ) : (
                <MicIcon className="h-5 w-5 text-white" />
            )}
        </span>
      </button>

      {/* Optional live interim preview */}
      {isListening && interim ? (
        <span className="text-purple-200 opacity-80 truncate">
          {interim}
        </span>
      ) : null}

      {error ? <span className="text-red-300">{error}</span> : null}
    </div>
  );
}