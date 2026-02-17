import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type TextSpeed = 'slow' | 'normal' | 'fast';

type AppSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  textSpeed: TextSpeed;
  difficultyAssist: boolean;
  reduceMotion: boolean;
  colorblindMode: boolean;
  autoAdvance: boolean;
  showTooltips: boolean;
};

const defaultSettings: AppSettings = {
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 75,
  textSpeed: 'normal',
  difficultyAssist: false,
  reduceMotion: false,
  colorblindMode: false,
  autoAdvance: true,
  showTooltips: true
};

const SETTINGS_KEY = 'hrpg_settings';

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetDefaults = () => {
    setSettings(defaultSettings);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-20">
      <div className="max-w-3xl w-full retro-panel">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl text-white retro-title">Settings</h1>
            <p className="text-sm text-purple-200 mt-2">
              Tune your interview gauntlet for peak performance.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetDefaults} className="text-xs">
              Reset Defaults
            </button>
            <button onClick={() => navigate('/')} className="text-xs">
              Back Home
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="space-y-4">
            <h2 className="text-lg text-white retro-subtitle">Audio</h2>

            <div>
              <label className="block text-xs text-purple-200 mb-2">Master Volume</label>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.masterVolume}
                onChange={(e) => updateSetting('masterVolume', Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-purple-300 mt-1">{settings.masterVolume}%</div>
            </div>

            <div>
              <label className="block text-xs text-purple-200 mb-2">Music Volume</label>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.musicVolume}
                onChange={(e) => updateSetting('musicVolume', Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-purple-300 mt-1">{settings.musicVolume}%</div>
            </div>

            <div>
              <label className="block text-xs text-purple-200 mb-2">SFX Volume</label>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.sfxVolume}
                onChange={(e) => updateSetting('sfxVolume', Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-purple-300 mt-1">{settings.sfxVolume}%</div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg text-white retro-subtitle">Gameplay</h2>

            <div>
              <label className="block text-xs text-purple-200 mb-2">Text Speed</label>
              <select
                value={settings.textSpeed}
                onChange={(e) => updateSetting('textSpeed', e.target.value as TextSpeed)}
                className="w-full"
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-3 text-xs text-purple-200">
              <span>Difficulty Assist (extra hints)</span>
              <input
                type="checkbox"
                checked={settings.difficultyAssist}
                onChange={(e) => updateSetting('difficultyAssist', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-purple-200">
              <span>Auto-advance to next question</span>
              <input
                type="checkbox"
                checked={settings.autoAdvance}
                onChange={(e) => updateSetting('autoAdvance', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-purple-200">
              <span>Show STAR method tips</span>
              <input
                type="checkbox"
                checked={settings.showTooltips}
                onChange={(e) => updateSetting('showTooltips', e.target.checked)}
              />
            </label>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg text-white retro-subtitle">Accessibility</h2>

            <label className="flex items-center justify-between gap-3 text-xs text-purple-200">
              <span>Reduce Motion</span>
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => updateSetting('reduceMotion', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-purple-200">
              <span>Colorblind-friendly palette</span>
              <input
                type="checkbox"
                checked={settings.colorblindMode}
                onChange={(e) => updateSetting('colorblindMode', e.target.checked)}
              />
            </label>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg text-white retro-subtitle">Account</h2>

            <div className="text-xs text-purple-200">
              Account preferences are tied to your login session. Log in to sync settings
              across devices.
            </div>

            <button
              onClick={() => localStorage.removeItem(SETTINGS_KEY)}
              className="text-xs"
            >
              Clear Local Settings
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Settings;
