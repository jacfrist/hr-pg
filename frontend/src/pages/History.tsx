import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';

type QuestionHistory = {
  questionId: number;
  turnIndex: number;
  questionType: string | null;
  prompt: string;
  answer: string | null;
  answeredAt: string | null;
  score: number | null;
  feedback: string | null;
};

type SessionHistory = {
  sessionId: number;
  role: string;
  difficulty: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  questions: QuestionHistory[];
};

function formatRole(roleId: string) {
  return roleId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function History() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axios.get(`${API_BASE_URL}/api/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistory(response.data.history || []);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message || 'Unable to load history.');
        } else {
          setError('Unable to load history.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [token]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="retro-panel max-w-xl w-full text-center space-y-4">
          <h1 className="text-2xl retro-title">History Locked</h1>
          <p className="text-sm text-purple-200">
            Log in to view your previous interview sessions, answers, and feedback.
          </p>
          <button onClick={() => navigate('/')} className="text-xs">
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="retro-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl retro-title">Session History</h1>
            <p className="text-sm text-purple-200">Review your past interview battles.</p>
          </div>
          <button onClick={() => navigate('/')} className="text-xs">
            Back Home
          </button>
        </div>

        {loading && (
          <div className="retro-panel text-center text-sm text-purple-200">Loading history...</div>
        )}

        {error && (
          <div className="retro-panel text-center text-sm text-red-300">{error}</div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="retro-panel text-center text-sm text-purple-200">
            No sessions yet. Finish a game to see your answers here.
          </div>
        )}

        <div className="space-y-6">
          {history.map((session) => (
            <div key={session.sessionId} className="retro-panel space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="text-lg text-white">{formatRole(session.role)}</div>
                  <div className="text-xs text-purple-200">
                    Difficulty: {session.difficulty} · Status: {session.status}
                  </div>
                </div>
                <div className="text-xs text-purple-300">
                  Started: {formatTimestamp(session.startedAt)}
                  <br />
                  Ended: {formatTimestamp(session.endedAt)}
                </div>
              </div>

              <div className="space-y-4">
                {session.questions.map((question) => (
                  <div key={question.questionId} className="bg-purple-950 bg-opacity-40 border border-purple-700 p-4">
                    <div className="text-xs text-purple-300 mb-2">
                      Q{question.turnIndex} · {question.questionType || 'Question'}
                    </div>
                    <div className="text-sm text-white mb-3">{question.prompt}</div>
                    <div className="text-xs text-purple-200 mb-2">Your Answer</div>
                    <div className="text-sm text-purple-100 mb-3">
                      {question.answer || 'No answer recorded.'}
                    </div>
                    <div className="text-xs text-purple-200 mb-1">Feedback</div>
                    <div className="text-sm text-purple-100">
                      {question.feedback || 'No feedback yet.'}
                    </div>
                    <div className="text-xs text-purple-300 mt-3">
                      Score: {question.score ?? '—'} · Answered: {formatTimestamp(question.answeredAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default History;
