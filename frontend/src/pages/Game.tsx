import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface GameState {
  bossHealth: number;
  playerHealth: number;
  currentQuestion: number;
  totalQuestions: number;
  question: string;
  feedback: string;
}

function Game() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'software_engineer';

  const [gameState, setGameState] = useState<GameState>({
    bossHealth: 100,
    playerHealth: 100,
    currentQuestion: 0,
    totalQuestions: 3,
    question: '',
    feedback: ''
  });

  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    startGame();
  }, []);

  const startGame = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/game/start`, { role });
      setGameState(prev => ({
        ...prev,
        bossHealth: response.data.bossHealth,
        playerHealth: response.data.playerHealth,
        totalQuestions: response.data.totalQuestions
      }));
      setGameStarted(true);
      loadNextQuestion();
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const loadNextQuestion = async () => {
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/game/question`, {
        role,
        questionNumber: gameState.currentQuestion
      });

      setGameState(prev => ({
        ...prev,
        question: response.data.question,
        currentQuestion: response.data.questionNumber,
        feedback: ''
      }));
    } catch (err: unknown) {
      console.error('Error loading question:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Unable to load question. Please check your API configuration and try again.');
      }
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/game/answer`, {
        answer,
        question: gameState.question,
        bossHealth: gameState.bossHealth,
        playerHealth: gameState.playerHealth,
        role
      });

      const newBossHealth = response.data.bossHealth;
      const newPlayerHealth = response.data.playerHealth;

      setGameState(prev => ({
        ...prev,
        bossHealth: newBossHealth,
        playerHealth: newPlayerHealth,
        feedback: response.data.feedback
      }));

      setAnswer('');

      setTimeout(() => {
        if (newBossHealth <= 0) {
          navigate(`/results?won=true&role=${role}`);
        } else if (newPlayerHealth <= 0) {
          navigate(`/results?won=false&role=${role}`);
        } else if (gameState.currentQuestion < gameState.totalQuestions) {
          loadNextQuestion();
        } else {
          if (newBossHealth < newPlayerHealth) {
            navigate(`/results?won=true&role=${role}`);
          } else {
            navigate(`/results?won=false&role=${role}`);
          }
        }
      }, 2000);

    } catch (err: unknown) {
      console.error('Error submitting answer:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Unable to grade your answer. Please check your API configuration and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthBarColor = (health: number) => {
    if (health > 60) return 'bg-green-500';
    if (health > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Health Bars */}
        <div className="mb-8 space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white font-bold">Boss (Recruiter)</span>
              <span className="text-white">{gameState.bossHealth}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-6">
              <div
                className={`${getHealthBarColor(gameState.bossHealth)} h-6 rounded-full transition-all duration-500`}
                style={{ width: `${gameState.bossHealth}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white font-bold">You (Candidate)</span>
              <span className="text-white">{gameState.playerHealth}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-6">
              <div
                className={`${getHealthBarColor(gameState.playerHealth)} h-6 rounded-full transition-all duration-500`}
                style={{ width: `${gameState.playerHealth}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-purple-800 bg-opacity-50 rounded-lg p-8 backdrop-blur-sm border border-purple-600 mb-6">
          <div className="text-purple-300 text-sm mb-2">
            Question {gameState.currentQuestion} of {gameState.totalQuestions}
          </div>
          <h2 className="text-2xl text-white font-bold mb-4">
            {gameState.question || 'Loading question...'}
          </h2>

          {gameState.feedback && (
            <div className="mb-4 p-4 bg-purple-900 bg-opacity-50 rounded-lg border border-purple-500">
              <p className="text-purple-200">{gameState.feedback}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-900 bg-opacity-50 rounded-lg border border-red-500">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full h-40 p-4 bg-purple-900 bg-opacity-50 border border-purple-600 rounded-lg text-white placeholder-purple-400 focus:outline-none focus:border-purple-400 mb-4"
            placeholder="Type your answer here using the STAR method (Situation, Task, Action, Result)..."
            disabled={isLoading}
          />

          <button
            onClick={submitAnswer}
            disabled={isLoading || !answer.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            {isLoading ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-purple-300 hover:text-white underline"
          >
            Quit Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default Game;
