import { setBgmVolume } from "./bgm";

const SETTINGS_KEY = "hrpg_settings";

type Stored = {
  masterVolume?: number;
  musicVolume?: number;
};

export function applyVolumeFromSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed: Stored = raw ? JSON.parse(raw) : {};

    const master = clamp01((parsed.masterVolume ?? 80) / 100);
    const music = clamp01((parsed.musicVolume ?? 70) / 100);

    setBgmVolume(master * music);
  } catch {
    // default volume if parsing fails
    setBgmVolume(0.8 * 0.7);
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}