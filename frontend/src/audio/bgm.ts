import bgmUrl from "../assets/bgm.mp3";

let audio: HTMLAudioElement | null = null;

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio(bgmUrl);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0; // start silent until we compute volume
  return audio;
}

export function setBgmVolume(volume01: number) {
  const a = ensureAudio();
  a.volume = Math.max(0, Math.min(1, volume01));
}

// Must be called from a user gesture (click/tap) or browser may block it.
export async function startBgmFromUserGesture() {
  const a = ensureAudio();
  try {
    await a.play();
  } catch {
    // blocked by autoplay policy; next user gesture can try again
  }
}

export function stopBgm() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}