const SETTINGS_KEY = "hrpg_settings";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function getSfxVolume(): number {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const master = Math.max(0, Math.min(1, (parsed.masterVolume ?? 80) / 100));
    const sfx = Math.max(0, Math.min(1, (parsed.sfxVolume ?? 75) / 100));
    return master * sfx;
  } catch {
    return 0.8 * 0.75;
  }
}

export function playPlayerAttack() {
  const ctx = getAudioContext();
  const volume = getSfxVolume();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Pitch sweeps up - satisfying hit
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.start(now);
  osc.stop(now + 0.2);
}

export function playBossAttack() {
  const ctx = getAudioContext();
  const volume = getSfxVolume();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Pitch sweeps down - threatening thud
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.start(now);
  osc.stop(now + 0.25);
}