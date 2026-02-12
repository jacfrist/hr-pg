import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import LevelSelect from './pages/LevelSelect';
import Game from './pages/Game';
import Results from './pages/Results';
import LoginModal from './components/LoginModal';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Router>
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
      </Routes>
    </Router>
  );
}

export default App;
