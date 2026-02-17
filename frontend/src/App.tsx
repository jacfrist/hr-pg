import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import LevelSelect from './pages/LevelSelect';
import Game from './pages/Game';
import Results from './pages/Results';
import Settings from './pages/Settings';
import History from './pages/History';
import LoginModal from './components/LoginModal';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Router>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Link
          to="/settings"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors border border-purple-400 inline-block"
        >
          Settings
        </Link>
        {user && (
          <Link
            to="/history"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors border border-purple-400 inline-block"
          >
            History
          </Link>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10">
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-purple-200 text-sm hidden sm:inline">Logged in as {user.email}</span>
            <button
              onClick={logout}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors border border-purple-400"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors border border-purple-400"
          >
            Login / Register
          </button>
        )}
      </div>

      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/level-select" element={<LevelSelect />} />
        <Route path="/game" element={<Game />} />
        <Route path="/results" element={<Results />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}

export default App;
