import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import MicDictation from '../components/asr/MicDictation';

interface GameState {
  bossHealth: number;
  playerHealth: number;
  currentQuestion: number;
  totalQuestions: number;
  question: string;
  feedback: string;
}

const GAME_STATE_KEY = 'hrpg_game_state_v1';
const SETTINGS_KEY = 'hrpg_settings';
const JOB_DESCRIPTION_DRAFT_KEY = 'hrpg_job_description_draft';

type GameplaySettings = {
  autoAdvance: boolean;
  showTooltips: boolean;
};

function loadGameplaySettings(): GameplaySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { autoAdvance: true, showTooltips: true };

    const parsed = JSON.parse(raw) as Partial<GameplaySettings>;
    return {
      autoAdvance: typeof parsed.autoAdvance === 'boolean' ? parsed.autoAdvance : true,
      showTooltips: typeof parsed.showTooltips === 'boolean' ? parsed.showTooltips : true
    };
  } catch {
    return { autoAdvance: true, showTooltips: true };
  }
}

type NextAction =
  | { kind: 'next'; nextQuestionNumber: number }
  | { kind: 'results'; won: boolean };

function Game() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'software_engineer';
  const difficulty = (searchParams.get('difficulty') || 'Medium');
  const interviewType = (searchParams.get('interviewType') || 'role');
  const mode = (searchParams.get('mode') || 'classic') as 'classic' | 'practice';
  const isPracticeMode = mode === 'practice';
  const [jobDescription, setJobDescription] = useState('');
  const { token } = useAuth();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    bossHealth: 100,
    playerHealth: 100,
    currentQuestion: 1,
    totalQuestions: 5,
    question: '',
    feedback: ''
  });

  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isShowingFeedback = Boolean(gameState.feedback);

  const [gameplaySettings, setGameplaySettings] = useState<GameplaySettings>(() => loadGameplaySettings());
  const shouldAutoAdvance = isPracticeMode ? false : gameplaySettings.autoAdvance;
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) setGameplaySettings(loadGameplaySettings());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(GAME_STATE_KEY);

    if (raw) {
      try {
        const saved = JSON.parse(raw);

        const canRestore =
          saved?.role === role &&
          saved?.difficulty === difficulty &&
          (saved?.interviewType || 'role') === interviewType &&
          saved?.gameState &&
          typeof saved.gameState.question === 'string' &&
          saved.gameState.question.trim().length > 0;

        if (canRestore) {
          setSessionId(saved.sessionId ?? null);
          setCurrentQuestionId(saved.currentQuestionId ?? null);
          setGameState(saved.gameState);
          setAnswer(saved.answer ?? '');
          setJobDescription(saved.jobDescription ?? '');
          setHydrated(true);
          return;
        }

        localStorage.removeItem(GAME_STATE_KEY);
      } catch {
        localStorage.removeItem(GAME_STATE_KEY);
      }
    }

    let draftJobDescription = '';
    setHydrated(true);
    if (interviewType === 'job_description') {
      draftJobDescription = localStorage.getItem(JOB_DESCRIPTION_DRAFT_KEY) || '';
      setJobDescription(draftJobDescription);
    }
    startGame(draftJobDescription);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!sessionId && gameState.currentQuestion === 0 && !gameState.question) return;

    const payload = {
      role,
      difficulty,
      interviewType,
      jobDescription,
      sessionId,
      currentQuestionId,
      gameState,
      answer,
    };

    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(payload));
  }, [hydrated, role, difficulty, interviewType, jobDescription, sessionId, currentQuestionId, gameState, answer]);

  const performNextAction = (action: NextAction) => {
    setNextAction(null);

    if (action.kind === 'results') {
      navigate(`/results?won=${action.won}&role=${role}&mode=${mode}&sessionId=${sessionId ?? ''}`);
      localStorage.removeItem(GAME_STATE_KEY);
      return;
    }

    setAnswer('');
    loadNextQuestion(undefined, action.nextQuestionNumber);
  };

  const startGame = async (jobDescriptionOverride?: string) => {
    setNextAction(null);
    const effectiveJobDescription = (jobDescriptionOverride ?? jobDescription).trim();

    if (interviewType === 'job_description' && !effectiveJobDescription) {
      setError('Please go back and paste a job description before starting this interview type.');
      return;
    }

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API_BASE_URL}/api/game/start`,
        {
          role,
          difficulty,
          mode,
          interviewType,
          jobDescription: interviewType === 'job_description' ? effectiveJobDescription : ''
        },
        { headers }
      );

      const newSessionId = response.data.sessionId as number | null;
      setSessionId(newSessionId);

      setGameState(prev => ({
        ...prev,
        bossHealth: response.data.bossHealth,
        playerHealth: response.data.playerHealth,
        totalQuestions: response.data.totalQuestions
      }));
      loadNextQuestion(newSessionId ?? undefined, 1);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const loadNextQuestion = async (sessionIdOverride?: number, questionNumberOverride?: number) => {
    setNextAction(null);
    setError('');
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const questionNumber1 = questionNumberOverride ?? gameState.currentQuestion;
      const questionNumber0 = Math.max(0, questionNumber1 - 1);

      const response = await axios.post(`${API_BASE_URL}/api/game/question`, {
        role,
        difficulty,
        mode,
        interviewType,
        jobDescription: interviewType === 'job_description' ? jobDescription : '',
        questionNumber: questionNumber0,
        sessionId: sessionIdOverride ?? sessionId
      }, { headers });

      setCurrentQuestionId(response.data.questionId);

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

    if (!currentQuestionId) {
      setError('Question is still loading. Please wait a moment and try again.');
      return;
    }

    setNextAction(null);
    setIsLoading(true);
    setError('');

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(`${API_BASE_URL}/api/game/answer`, {
        answer,
        question: gameState.question,
        bossHealth: gameState.bossHealth,
        playerHealth: gameState.playerHealth,
        role,
        difficulty,
        interviewType,
        mode,
        jobDescription: interviewType === 'job_description' ? jobDescription : '',
        sessionId,
        questionId: currentQuestionId,
        questionNumber: gameState.currentQuestion,
        totalQuestions: gameState.totalQuestions
      }, { headers });

      const newBossHealth = response.data.bossHealth;
      const newPlayerHealth = response.data.playerHealth;

      setGameState(prev => ({
        ...prev,
        bossHealth: newBossHealth,
        playerHealth: newPlayerHealth,
        feedback: response.data.feedback
      }));

      const computed: NextAction = (() => {
        const nextQuestionNumber = gameState.currentQuestion + 1;

        if (isPracticeMode) {
          if (nextQuestionNumber <= gameState.totalQuestions) {
            return { kind: 'next', nextQuestionNumber };
          }

          return { kind: 'results', won: true };
        }

        if (newBossHealth <= 0) return { kind: 'results', won: true };
        if (newPlayerHealth <= 0) return { kind: 'results', won: false };

        if (nextQuestionNumber <= gameState.totalQuestions) {
          return { kind: 'next', nextQuestionNumber };
        }

        return { kind: 'results', won: newBossHealth < newPlayerHealth };
      })();

      if (shouldAutoAdvance) {
        setTimeout(() => performNextAction(computed), 2000);
      } else {
        setNextAction(computed);
      }

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
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-4 pt-20">
      <div className="max-w-4xl mx-auto">
        {!isPracticeMode ? (
          /* Health Bars */
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
        ) : (
          <div className="mb-8 rounded-lg border border-cyan-500 bg-cyan-900 bg-opacity-30 p-4 text-center">
            <div className="text-cyan-200 font-bold text-lg">Practice Mode</div>
            <div className="text-cyan-100 text-sm mt-1">
              Focus on feedback and improving each response before moving on.
            </div>
          </div>
        )}

        {/* Question Card */}
        <div className="bg-purple-800 bg-opacity-50 rounded-lg p-8 backdrop-blur-sm border border-purple-600 mb-6">
          <div className="text-purple-300 text-sm mb-2">
            Question {gameState.currentQuestion} of {gameState.totalQuestions}
          </div>
          <div className="text-purple-300 text-sm mb-4">
            Difficulty: <span className="text-white font-semibold">{difficulty}</span>
          </div>
          <div className="text-purple-300 text-sm mb-4">
            Interview type:{' '}
            <span className="text-white font-semibold">
              {interviewType === 'job_description' ? 'Job Description-Based' : 'Role-Based'}
            </span>
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

          {gameplaySettings.showTooltips && !gameState.feedback && (
            <div className="mb-4 p-4 bg-purple-900 bg-opacity-40 rounded-lg border border-purple-600">
              <div className="text-purple-200 text-sm font-semibold mb-2">STAR method quick reminder</div>
              <ul className="text-purple-200 text-sm list-disc pl-5 space-y-1">
                <li><b>Situation:</b> set the context (1 sentence)</li>
                <li><b>Task:</b> what you needed to achieve</li>
                <li><b>Action:</b> what <i>you</i> did (be specific)</li>
                <li><b>Result:</b> measurable outcome + what you learned</li>
              </ul>
            </div>
          )}

          <div>
          <MicDictation value={answer} onChange={setAnswer} disabled={isLoading || isShowingFeedback} />

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className={`w-full ${isShowingFeedback ? 'h-24' : 'h-40'} p-4 bg-purple-900 bg-opacity-50 border border-purple-600 rounded-lg text-white placeholder-purple-400 focus:outline-none focus:border-purple-400 mb-4`}
            placeholder="Type your answer here using the STAR method (Situation, Task, Action, Result)..."
            disabled={isLoading || isShowingFeedback}
          />
        </div>

        {!isShowingFeedback && (
          <button
            onClick={submitAnswer}
            disabled={
              isLoading ||
              !currentQuestionId ||
              !answer.trim() ||
              (!!nextAction && !shouldAutoAdvance)
            }
            className={[
              "w-full text-white font-bold py-3 px-6 rounded-lg transition-all duration-200",
              (isLoading || !currentQuestionId || !answer.trim() || (!!nextAction && !shouldAutoAdvance))
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 transform hover:scale-105"
            ].join(" ")}
          >
            {isLoading ? 'Submitting...' : isPracticeMode ? 'Get Feedback' : 'Submit Answer'}
          </button>
        )}

        {isShowingFeedback && (
          <div className="mt-3 text-xs text-purple-300">
            Review your response and feedback, then continue.
          </div>
        )}

          {!shouldAutoAdvance && nextAction && (
            <button
              onClick={() => performNextAction(nextAction)}
              className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
            >
              {nextAction.kind === 'results' ? 'View Results' : 'Next Question'}
            </button>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => {
              localStorage.removeItem(GAME_STATE_KEY);
              navigate('/');
            }}
            className="text-purple-300 hover:text-white underline"
          >
            {isPracticeMode ? 'End Practice' : 'Quit Game'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Game;
