import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-white mb-4">HR-PG</h1>
        <p className="text-2xl text-purple-200 mb-2">Human Resources - Professional Gauntlet</p>
        <p className="text-lg text-purple-300 mb-8">
          Battle your way through the interview process!
        </p>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/level-select')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Start Game
          </button>

          <div className="text-purple-300 text-sm mt-8">
            <p>Defeat the recruiter boss by giving excellent interview answers!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
