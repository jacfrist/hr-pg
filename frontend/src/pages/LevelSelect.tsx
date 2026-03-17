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

    navigate(`/game?role=${roleId}&difficulty=${difficulty}&interviewType=${interviewType}`);
  };

  const difficultyPill = (d: 'Easy' | 'Medium' | 'Hard') => {
    const active = d === difficulty;
    const base = 'px-4 py-2 rounded-full text-white text-sm font-semibold transition-all duration-150 border';
    if (d === 'Easy') return `${base} ${active ? 'bg-green-600 border-green-400' : 'bg-green-900 bg-opacity-40 border-green-700 hover:border-green-400'}`;
    if (d === 'Hard') return `${base} ${active ? 'bg-red-600 border-red-400' : 'bg-red-900 bg-opacity-40 border-red-700 hover:border-red-400'}`;
    return `${base} ${active ? 'bg-yellow-600 border-yellow-400' : 'bg-yellow-900 bg-opacity-40 border-yellow-700 hover:border-yellow-400'}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4 pt-20">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">Select Your Role</h1>
          <p className="text-purple-200">Choose the position and difficulty you want to interview for</p>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="text-purple-200">Difficulty</div>
          <div className="flex gap-3 flex-wrap justify-center">
            {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={difficultyPill(d)}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Interview Type Selection */}
        <div className="mb-8 max-w-3xl mx-auto">
          <div className="text-purple-200 text-center mb-3">Interview Type</div>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <button
              type="button"
              className={`px-4 py-2 rounded-full text-white text-sm font-semibold border transition-all duration-150 ${interviewType === 'role' ? 'bg-indigo-600 border-indigo-400' : 'bg-indigo-900 bg-opacity-40 border-indigo-700 hover:border-indigo-400'}`}
              onClick={() => setInterviewType('role')}
            >
              Role-Based (default)
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-full text-white text-sm font-semibold border transition-all duration-150 ${interviewType === 'job_description' ? 'bg-indigo-600 border-indigo-400' : 'bg-indigo-900 bg-opacity-40 border-indigo-700 hover:border-indigo-400'}`}
              onClick={() => setInterviewType('job_description')}
            >
              Job Description-Based
            </button>
          </div>

          {interviewType === 'job_description' && (
            <div className="bg-purple-900 bg-opacity-40 border border-purple-600 rounded-lg p-4">
              <label htmlFor="jobDescription" className="block text-purple-200 text-sm mb-2">
                Paste the job description you are interviewing for
              </label>
              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full h-36 p-3 bg-purple-900 bg-opacity-60 border border-purple-600 rounded-lg text-white placeholder-purple-400 focus:outline-none focus:border-purple-400"
                placeholder="Paste responsibilities, requirements, and preferred qualifications..."
              />
              <p className="text-xs text-purple-300 mt-2">
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
                className="bg-purple-800 bg-opacity-50 rounded-lg p-6 backdrop-blur-sm border border-purple-600 hover:border-purple-400 transition-all duration-200"
              >
                <h3 className="text-2xl font-bold text-white mb-3">{role.name}</h3>
                <div className="mb-4 text-sm text-purple-300">
                  Selected difficulty: <span className="text-white font-semibold">{difficulty}</span>
                </div>
                <button
                  onClick={() => selectRole(role.id)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
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
            className="text-purple-300 hover:text-white underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default LevelSelect;
