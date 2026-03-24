import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

type ResultItem = {
  questionNumber: number;
  question: string;
  answer: string;
  feedback: string;
  score: number | null;
};

type SessionResults = {
  sessionId: number;
  role: string;
  difficulty: string;
  status: string;
  questions: ResultItem[];
};

function Results() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const won = searchParams.get('won') === 'true';
  const role = searchParams.get('role') || 'software_engineer';
  const mode = (searchParams.get('mode') || 'classic') as 'classic' | 'practice';
  const sessionId = searchParams.get('sessionId');
  const isPracticeMode = mode === 'practice';

  const [results, setResults] = useState<SessionResults | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState('');

  const formatRole = (roleId: string) => {
    return roleId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        setError('');
        const response = await axios.get(`${API_BASE_URL}/api/game/results/${sessionId}`);
        setResults(response.data);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Unable to load question-by-question results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-4 pt-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          {isPracticeMode ? (
            <div className="space-y-6">
              <div className="text-6xl mb-4">🧠</div>
              <h1 className="text-5xl font-bold text-white mb-4">Practice Session Complete</h1>
              <p className="text-2xl text-purple-200 mb-6">
                Nice work practicing for the {formatRole(role)} interview.
              </p>
            </div>
          ) : won ? (
            <div className="space-y-6">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-5xl font-bold text-white mb-4">You Got the Job!</h1>
              <p className="text-2xl text-purple-200 mb-6">
                Congratulations! You defeated the {formatRole(role)} recruiter boss!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-6xl mb-4">😔</div>
              <h1 className="text-5xl font-bold text-white mb-4">You Got Ghosted</h1>
              <p className="text-2xl text-purple-200 mb-6">
                The {formatRole(role)} recruiter boss was too tough this time.
              </p>
            </div>
          )}
        </div>

        <div className="bg-purple-800 bg-opacity-40 rounded-lg p-6 border border-purple-600 mb-8">
          <h2 className="text-2xl text-white font-bold mb-4">Question-by-Question Review</h2>

          {loading ? (
            <p className="text-purple-200">Loading results...</p>
          ) : error ? (
            <p className="text-red-200">{error}</p>
          ) : results?.questions?.length ? (
            <div className="space-y-6">
              {results.questions.map((item) => (
                <div
                  key={item.questionNumber}
                  className="bg-purple-900 bg-opacity-50 rounded-lg p-5 border border-purple-500"
                >
                  <div className="text-sm text-purple-300 mb-2">
                    Question {item.questionNumber}
                    {item.score !== null && (
                      <span className="ml-3 text-purple-200">Score: {item.score}/10</span>
                    )}
                  </div>

                  <div className="mb-4">
                    <h3 className="text-white font-semibold mb-2">Question</h3>
                    <p className="text-purple-100">{item.question}</p>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-white font-semibold mb-2">Your Response</h3>
                    <p className="text-purple-100 whitespace-pre-wrap">
                      {item.answer || 'No response saved.'}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold mb-2">Feedback</h3>
                    <p className="text-purple-100 whitespace-pre-wrap">
                      {item.feedback || 'No feedback available.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-purple-200">No question history available for this session.</p>
          )}
        </div>

        <div className="text-center space-y-4">
          <button
            onClick={() => navigate('/level-select')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 shadow-lg w-full sm:w-auto"
          >
            {isPracticeMode ? 'Practice Again' : 'Play Again'}
          </button>
          <br />
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

export default Results;