import { useNavigate } from 'react-router-dom';
import { startBgmFromUserGesture } from '../audio/bgm';
import { applyVolumeFromSettings } from '../audio/settingsVolume';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold retro-title mb-4">HR-PG</h1>
        <p className="text-2xl text-cyan-200 mb-2">Human Resources - Professional Gauntlet</p>
        <p className="text-lg text-cyan-300 mb-8">
          Battle your way through the interview process!
        </p>

        <div className="space-y-4">
          <button
            onClick={async () => {
              await startBgmFromUserGesture();
              applyVolumeFromSettings();
              navigate('/level-select');
            }}
            className="text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
            style={{
              background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
              border: '2px solid var(--retro-border)',
              boxShadow: '0 0 0 2px var(--retro-border-dark), 0 6px 0 rgba(0, 0, 0, 0.5)'
            }}
          >
            Start Game
          </button>

          <div className="text-cyan-300 text-sm mt-8">
            <p>Defeat the recruiter boss by giving excellent interview answers!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
