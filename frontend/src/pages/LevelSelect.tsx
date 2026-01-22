import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface Role {
  id: string;
  name: string;
  difficulty: string;
}

function LevelSelect() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

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

  const selectRole = (roleId: string) => {
    navigate(`/game?role=${roleId}`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-600 hover:bg-green-700';
      case 'medium':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'hard':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">Select Your Role</h1>
          <p className="text-purple-200">Choose the position you want to interview for</p>
        </div>

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
                <div className="mb-4">
                  <span className="text-sm text-purple-300">Difficulty: </span>
                  <span className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${getDifficultyColor(role.difficulty)}`}>
                    {role.difficulty}
                  </span>
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
