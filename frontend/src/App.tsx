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
      <div className="fixed top-0 left-0 right-0 z-50 bg-black">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              className="text-white tracking-tighter font-bold py-1 px-4 rounded text-xs transition-colors inline-block"
              style={{
                background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                border: '2px solid var(--retro-border)',
                boxShadow: '0 0 0 2px var(--retro-border-dark)'
              }}
            >
              Settings
            </Link>
            {user && (
              <Link
                to="/history"
                className="text-white tracking-tighter font-bold py-1 px-4 rounded text-xs transition-colors inline-block"
                style={{
                  background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                  border: '2px solid var(--retro-border)',
                  boxShadow: '0 0 0 2px var(--retro-border-dark)'
                }}
              >
                History
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-cyan-200 text-xs sm:text-xs hidden md:inline truncate max-w-[150px] lg:max-w-none">{user.email}</span>
                <button
                  onClick={logout}
                  className="text-white tracking-tight font-bold py-1 px-4 rounded text-xs transition-colors whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                    border: '2px solid var(--retro-border)',
                    boxShadow: '0 0 0 2px var(--retro-border-dark)'
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-white tracking-tighter font-bold py-1 px-4 rounded text-xs transition-colors whitespace-nowrap"
                style={{
                  background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                  border: '2px solid var(--retro-border)',
                  boxShadow: '0 0 0 2px var(--retro-border-dark)'
                }}
              >
                Login / Register
              </button>
            )}
          </div>
        </div>
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
