import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface Role {
  id: string;
  name: string;
}

function LevelSelect() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [interviewType, setInterviewType] = useState<'role' | 'job_description'>('role');
  const [jobDescription, setJobDescription] = useState('');
  const [mode, setMode] = useState<'classic' | 'practice'>('classic');
  const [error, setError] = useState('');

  const fetchRoles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/roles`);
      setRoles(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching roles:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoles();
  }, []);

  const selectRole = (roleId: string) => {
    const trimmedJobDescription = jobDescription.trim();

    if (interviewType === 'job_description' && !trimmedJobDescription) {
      setError('Please paste a job description to continue.');
      return;
    }

    setError('');

    if (interviewType === 'job_description') {
      localStorage.setItem('hrpg_job_description_draft', trimmedJobDescription);
    } else {
      localStorage.removeItem('hrpg_job_description_draft');
    }

    navigate(`/game?role=${roleId}&difficulty=${difficulty}&interviewType=${interviewType}&mode=${mode}`);
  };

  const getDifficultyStyle = (d: 'Easy' | 'Medium' | 'Hard') => {
    const active = d === difficulty;

    // Color schemes for each difficulty
    const colors = {
      Easy: { border: '#7cff6b', glow: '#7cff6b', bg: 'linear-gradient(180deg, #2d5a2d, #1e3f1e)' },
      Medium: { border: '#ffd166', glow: '#ffd166', bg: 'linear-gradient(180deg, #5a4d2d, #3f361e)' },
      Hard: { border: '#ff6b6b', glow: '#ff6b6b', bg: 'linear-gradient(180deg, #5a2d2d, #3f1e1e)' }
    };

    const color = colors[d];

    if (active) {
      return {
        background: color.bg,
        borderColor: color.border,
        boxShadow: `0 0 10px ${color.glow}`
      };
    }
    return {
      backgroundColor: 'rgba(31, 36, 64, 0.4)',
      borderColor: 'var(--retro-border-dark)'
    };
  };

  const getModeStyle = (m: 'classic' | 'practice') => {
    const active = m === mode;

    // Color schemes for each mode
    const colors = {
      classic: { border: '#ff5ef7', glow: '#ff5ef7', bg: 'linear-gradient(180deg, #4d2d5a, #361e3f)' },
      practice: { border: '#7cff6b', glow: '#7cff6b', bg: 'linear-gradient(180deg, #2d5a2d, #1e3f1e)' }
    };

    const color = colors[m];

    if (active) {
      return {
        background: color.bg,
        borderColor: color.border,
        boxShadow: `0 0 10px ${color.glow}`
      };
    }
    return {
      backgroundColor: 'rgba(31, 36, 64, 0.4)',
      borderColor: 'var(--retro-border-dark)'
    };
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-20">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold retro-title mb-4">Select Your Role</h1>
        </div>

        {/* Difficulty and Mode Selection - Same Line */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex gap-12 flex-wrap justify-center items-start">
            {/* Difficulty Selection */}
            <div className="flex flex-col items-center gap-3">
              <div className="text-cyan-200 text-sm font-semibold">Difficulty</div>
              <div className="flex gap-3 flex-wrap justify-center">
                {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="px-4 py-2 rounded text-white text-sm font-semibold transition-all duration-150 border-2"
                    style={getDifficultyStyle(d)}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Selection */}
            <div className="flex flex-col items-center gap-3">
              <div className="text-cyan-200 text-sm font-semibold">Mode</div>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  type="button"
                  className="px-4 py-2 rounded text-white text-sm font-semibold transition-all duration-150 border-2"
                  style={getModeStyle('classic')}
                  onClick={() => setMode('classic')}
                >
                  Classic
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded text-white text-sm font-semibold transition-all duration-150 border-2"
                  style={getModeStyle('practice')}
                  onClick={() => setMode('practice')}
                >
                  Practice
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Interview Type Selection */}
        <div className="mb-8 mx-auto">
          <div className="text-cyan-200 text-center mb-3 text-sm font-semibold">Interview Type</div>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <button
              type="button"
              className="px-4 py-2 rounded text-white text-sm font-semibold border-2 transition-all duration-150"
              style={interviewType === 'role' ? {
                background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                borderColor: 'var(--retro-border)',
                boxShadow: '0 0 10px var(--retro-border)'
              } : {
                backgroundColor: 'rgba(31, 36, 64, 0.4)',
                borderColor: 'var(--retro-border-dark)'
              }}
              onClick={() => setInterviewType('role')}
            >
              Role-Based (default)
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded text-white text-sm font-semibold border-2 transition-all duration-150"
              style={interviewType === 'job_description' ? {
                background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                borderColor: 'var(--retro-border)',
                boxShadow: '0 0 10px var(--retro-border)'
              } : {
                backgroundColor: 'rgba(31, 36, 64, 0.4)',
                borderColor: 'var(--retro-border-dark)'
              }}
              onClick={() => setInterviewType('job_description')}
            >
              Job Description-Based
            </button>
          </div>

          {interviewType === 'job_description' && (
            <div className="retro-panel">
              <label htmlFor="jobDescription" className="block text-cyan-200 text-sm mb-2">
                Paste the job description you are interviewing for
              </label>
              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full h-36 p-3 rounded-lg text-white placeholder-cyan-400"
                style={{
                  backgroundColor: 'var(--retro-panel)',
                  border: '2px solid var(--retro-border)',
                  boxShadow: 'inset 0 0 0 2px var(--retro-border-dark)'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--retro-accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--retro-border)'}
                placeholder="Paste responsibilities, requirements, and preferred qualifications..."
              />
              <p className="text-xs text-cyan-300 mt-2">
                Questions will be generated based on this posting while still matching your selected role and difficulty.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 text-center">
            <p className="inline-block px-4 py-2 rounded-lg bg-red-900 bg-opacity-50 border border-red-500 text-red-200 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center text-white text-xl">Loading roles...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div
                key={role.id}
                className="retro-panel transition-all duration-200"
                style={{
                  cursor: 'pointer'
                }}
              >
                <h3 className="text-2xl font-bold text-white mb-3">{role.name}</h3>
                <div className="mb-4 text-sm text-cyan-300 space-y-1">
                  <div>
                    Difficulty: <span className="text-white font-semibold">{difficulty}</span>
                  </div>
                  <div>
                    Mode: <span className="text-white font-semibold capitalize">{mode}</span>
                  </div>
                </div>
                <button
                  onClick={() => selectRole(role.id)}
                  className="w-full text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
                  style={{
                    background: 'linear-gradient(180deg, #4d2d5a, #361e3f)',
                    border: '2px solid #ff5ef7',
                    boxShadow: '0 0 0 2px var(--retro-border-dark), 0 6px 0 rgba(0, 0, 0, 0.5)'
                  }}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/')}
            className="text-cyan-300 hover:text-white underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default LevelSelect;
