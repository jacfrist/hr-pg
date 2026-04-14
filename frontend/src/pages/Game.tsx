import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import MicDictation from '../components/asr/MicDictation';
import { playPlayerAttack, playBossAttack } from '../audio/sfx';

import sweBoss from '../assets/swe-boss.png';
import sweBossMove from '../assets/swe-boss-move.png';
import sweBossDmg from '../assets/swe-boss-dmg.png';
import dataBoss from '../assets/data-boss.png';
import dataBossMove from '../assets/data-boss-move.png';
import dataBossDmg from '../assets/data-boss-dmg.png';
import pmBoss from '../assets/pm-boss.png';
import pmBossMove from '../assets/pm-boss-move.png';
import pmBossDmg from '../assets/pm-boss-dmg.png';
import player from '../assets/player.png';
import playerMove from '../assets/player-move.png';
import background from '../assets/background.png';

const BOSS_SPRITES: Record<string, { idle: string; move: string; dmg: string }> = {
  software_engineer: { idle: sweBoss, move: sweBossMove, dmg: sweBossDmg },
  data_scientist: { idle: dataBoss, move: dataBossMove, dmg: dataBossDmg },
  product_manager: { idle: pmBoss, move: pmBossMove, dmg: pmBossDmg },
};

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
const STOPWATCH_PREFS_KEY = 'hrpg_game_stopwatch';

const NUDGE_INTERVAL_SECONDS = 20;

type StopwatchPrefs = {
  enabled: boolean;
  temperature: number;
};

function loadStopwatchPrefs(): StopwatchPrefs {
  try {
    const raw = localStorage.getItem(STOPWATCH_PREFS_KEY);
    if (!raw) return { enabled: false, temperature: 35 };
    const p = JSON.parse(raw) as Partial<StopwatchPrefs>;
    return {
      enabled: Boolean(p.enabled),
      temperature:
        typeof p.temperature === 'number'
          ? Math.min(100, Math.max(0, p.temperature))
          : 35,
    };
  } catch {
    return { enabled: false, temperature: 35 };
  }
}

function stripHyphensFromNudge(text: string): string {
  return text
    .replace(/\u2013/g, " ")
    .replace(/\u2014/g, " ")
    .replace(/\u2212/g, " ")
    .replace(/-+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatStopwatchTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

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
  const initializationStarted = useRef(false);

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

  // Boss sprite animation state
  const [idleFrame, setIdleFrame] = useState(0);
  const [showDmg, setShowDmg] = useState(false);
  const prevBossHealth = useRef(gameState.bossHealth);

  // Player sprite animation state
  const [playerFrame, setPlayerFrame] = useState(0);

  const sprites = BOSS_SPRITES[role] || BOSS_SPRITES.software_engineer;

  // Idle animation: alternate between idle and move every 500ms
  useEffect(() => {
    if (showDmg) return;
    const timer = setInterval(() => {
      setIdleFrame(f => (f === 0 ? 1 : 0));
    }, 500);
    return () => clearInterval(timer);
  }, [showDmg]);

  // Player animation: alternate between player and player-move every 500ms
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayerFrame(f => (f === 0 ? 1 : 0));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Damage animation: trigger when boss health decreases
  useEffect(() => {
    if (gameState.bossHealth < prevBossHealth.current) {
      setShowDmg(true);
      const timer = setTimeout(() => setShowDmg(false), 1000);
      prevBossHealth.current = gameState.bossHealth;
      return () => clearTimeout(timer);
    }
    prevBossHealth.current = gameState.bossHealth;
  }, [gameState.bossHealth]);

  const currentSprite = showDmg
    ? sprites.dmg
    : idleFrame === 0
      ? sprites.idle
      : sprites.move;

  const currentPlayerSprite = playerFrame === 0 ? player : playerMove;

  const isShowingFeedback = Boolean(gameState.feedback);

  const [gameplaySettings, setGameplaySettings] = useState<GameplaySettings>(() => loadGameplaySettings());
  const shouldAutoAdvance = isPracticeMode ? false : gameplaySettings.autoAdvance;
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  // Read stopwatch settings from URL params (passed from LevelSelect)
  const stopwatchFromUrl = searchParams.get('stopwatch') === 'true';
  const nudgeTempFromUrl = Number(searchParams.get('nudgeTemp')) || 35;

  const [stopwatchEnabled, setStopwatchEnabled] = useState(() => stopwatchFromUrl);
  const [nudgeTemperature, setNudgeTemperature] = useState(() => nudgeTempFromUrl);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latestNudge, setLatestNudge] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);

  const nudgeBucketRef = useRef(0);
  const nudgeInFlightRef = useRef(false);
  const currentQuestionIdRef = useRef<number | null>(null);
  currentQuestionIdRef.current = currentQuestionId;
  const isShowingFeedbackRef = useRef(isShowingFeedback);
  isShowingFeedbackRef.current = isShowingFeedback;

  useEffect(() => {
    localStorage.setItem(
      STOPWATCH_PREFS_KEY,
      JSON.stringify({ enabled: stopwatchEnabled, temperature: nudgeTemperature })
    );
  }, [stopwatchEnabled, nudgeTemperature]);

  useEffect(() => {
    if (!stopwatchEnabled) {
      setElapsedSeconds(0);
      nudgeBucketRef.current = 0;
      setLatestNudge(null);
      setNudgeLoading(false);
      return;
    }
    setElapsedSeconds(0);
    nudgeBucketRef.current = 0;
    setLatestNudge(null);
  }, [stopwatchEnabled]);

  useEffect(() => {
    if (!currentQuestionId) return;
    setElapsedSeconds(0);
    nudgeBucketRef.current = 0;
    setLatestNudge(null);
  }, [currentQuestionId]);

  const stopwatchActive =
    stopwatchEnabled &&
    !isShowingFeedback &&
    Boolean(currentQuestionId) &&
    gameState.question.trim().length > 0;

  useEffect(() => {
    if (!stopwatchActive) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((e) => e + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [stopwatchActive]);

  useEffect(() => {
    if (!stopwatchActive) return;
    if (elapsedSeconds <= 0 || elapsedSeconds % NUDGE_INTERVAL_SECONDS !== 0) return;
    const bucket = elapsedSeconds / NUDGE_INTERVAL_SECONDS;
    if (bucket <= nudgeBucketRef.current) return;

    const questionSnapshot = gameState.question;
    const qidSnapshot = currentQuestionIdRef.current;
    if (!questionSnapshot.trim() || nudgeInFlightRef.current) return;

    nudgeBucketRef.current = bucket;
    nudgeInFlightRef.current = true;
    setNudgeLoading(true);

    axios
      .post(`${API_BASE_URL}/api/game/nudge`, {
        role,
        difficulty,
        interviewType,
        question: questionSnapshot,
        nudgeTemperature,
        secondsElapsed: elapsedSeconds,
      })
      .then((res) => {
        if (
          currentQuestionIdRef.current !== qidSnapshot ||
          isShowingFeedbackRef.current
        ) {
          return;
        }
        const text = res.data?.nudge;
        if (typeof text === 'string' && text.trim()) {
          setLatestNudge(stripHyphensFromNudge(text.trim()));
        }
      })
      .catch(() => {
        if (
          currentQuestionIdRef.current !== qidSnapshot ||
          isShowingFeedbackRef.current
        ) {
          return;
        }
        setLatestNudge(
          nudgeTemperature >= 70
            ? "We are almost out of time here. I need a direct answer from you now, in one or two clear sentences."
            : "Take a breath. You have got this. Walk through Situation, Task, Action, Result, then submit when you feel ready."
        );
      })
      .finally(() => {
        nudgeInFlightRef.current = false;
        setNudgeLoading(false);
      });
  }, [
    elapsedSeconds,
    stopwatchActive,
    role,
    difficulty,
    interviewType,
    nudgeTemperature,
    gameState.question,
  ]);

  useEffect(() => {
    if (isShowingFeedback) {
      setLatestNudge(null);
      setNudgeLoading(false);
    }
  }, [isShowingFeedback]);

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

    if (initializationStarted.current) return;
    initializationStarted.current = true;

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

      if (newBossHealth < gameState.bossHealth) playPlayerAttack();
      if (newPlayerHealth < gameState.playerHealth) playBossAttack();

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
    <div className="min-h-screen p-4 pt-20">
      <div className="max-w-4xl mx-auto">

        {/* Top meta row */}
        <div className="flex items-center justify-between mb-3 text-sm text-cyan-300">
          <span>Question <span className="text-white font-semibold">{gameState.currentQuestion}</span> of {gameState.totalQuestions}</span>
          <span>Difficulty: <span className="text-white font-semibold">{difficulty}</span></span>
          <span>
            {interviewType === 'job_description' ? 'Job Description-Based' : 'Role-Based'}
          </span>
        </div>

        {/* Game Scene Window - Pokemon Battle Style */}
        <div
          className="relative w-full h-96 mb-6 rounded-lg overflow-hidden border-2 shadow-2xl"
          style={{
            backgroundImage: `url(${background})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            imageRendering: 'pixelated',
            borderColor: 'var(--retro-border)'
          }}
        >
          {/* Player Sprite - Bottom Left (Foreground) */}
          <div className="absolute bottom-0 left-0 w-64 h-64 overflow-hidden">
            <img
              src={currentPlayerSprite}
              alt="Player"
              className="w-full h-full object-cover object-top-left"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* Player Health Bar - Above Player */}
          {!isPracticeMode && (
            <div className="absolute bottom-64 left-16 w-48">
              <div className="bg-white bg-opacity-90 rounded-lg p-2 shadow-lg border-2 border-gray-800">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-800 text-xs font-bold">You</span>
                  <span className="text-gray-800 text-xs font-bold">{gameState.playerHealth}%</span>
                </div>
                <div className="w-full bg-gray-400 rounded-full h-2 border border-gray-600">
                  <div
                    className={`${getHealthBarColor(gameState.playerHealth)} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${gameState.playerHealth}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stopwatch Timer - Top Right Corner */}
          {stopwatchEnabled && (
            <div className="absolute top-4 right-4">
              <div
                className="font-mono text-3xl text-white tabular-nums tracking-wider drop-shadow-lg"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                aria-live="polite"
              >
                {formatStopwatchTime(elapsedSeconds)}
              </div>
            </div>
          )}

          {/* Boss Sprite - Top Right */}
          <div className="absolute top-16 right-12">
            <img
              src={currentSprite}
              alt="Boss"
              className="w-64 h-64 object-contain drop-shadow-lg"
              style={{
                imageRendering: 'pixelated',
                transform: role === 'software_engineer' ? 'scale(0.8)' : 'scale(1)',
                filter: role === 'software_engineer' ? 'brightness(1.2) contrast(1.1)' : 'none'
              }}
            />
          </div>

          {/* Boss Speech Bubble - Interviewer Prompts */}
          {stopwatchEnabled && (nudgeLoading || (latestNudge && !isShowingFeedback)) && (
            <div className="absolute top-48 right-64 w-64">
              {/* Speech bubble tail */}
              <div
                className="absolute top-4 -right-3 w-0 h-0"
                style={{
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderLeft: '14px solid rgba(255, 255, 255, 0.95)',
                  filter: 'drop-shadow(2px 0px 2px rgba(0,0,0,0.2))'
                }}
              />
              {/* Speech bubble content */}
              <div
                className={[
                  'rounded-lg px-4 py-3 text-[10px] leading-snug shadow-xl',
                  nudgeTemperature >= 67
                    ? 'border-2 border-amber-500 bg-amber-50/95 text-amber-900'
                    : nudgeTemperature <= 33
                      ? 'border-2 border-cyan-500 bg-cyan-50/95 text-cyan-900'
                      : 'border-2 border-purple-400 bg-white/95 text-gray-800',
                ].join(' ')}
              >
                {nudgeLoading ? (
                  <span className="italic opacity-75">...</span>
                ) : (
                  <span>{latestNudge}</span>
                )}
              </div>
            </div>
          )}

          {/* Boss Health Bar - Above Boss */}
          {!isPracticeMode && (
            <div className="absolute top-8 right-48 w-48">
              <div className="bg-white bg-opacity-90 rounded-lg p-2 shadow-lg border-2 border-gray-800">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-800 text-xs font-bold">Boss</span>
                  <span className="text-gray-800 text-xs font-bold">{gameState.bossHealth}%</span>
                </div>
                <div className="w-full bg-gray-400 rounded-full h-2 border border-gray-600">
                  <div
                    className={`${getHealthBarColor(gameState.bossHealth)} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${gameState.bossHealth}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Practice Mode Badge */}
          {isPracticeMode && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div className="rounded-lg border-2 border-cyan-400 bg-cyan-900 bg-opacity-90 px-4 py-2 shadow-lg">
                <span className="text-cyan-200 font-bold text-sm">Practice Mode</span>
              </div>
            </div>
          )}
        </div>

        {/* Question Card */}
        <div className="retro-panel mb-6">
          <h2 className="text-lg tracking-tight text-white font-bold mb-2">
            {gameState.question || 'Loading question...'}
          </h2>

          {gameState.feedback && (
            <div className="mb-2 p-4 rounded-lg border-2" style={{ borderColor: 'var(--retro-border)', backgroundColor: 'rgba(31, 36, 64, 0.6)' }}>
              <p className="text-cyan-200">{gameState.feedback}</p>
            </div>
          )}

          {error && (
            <div className="mb-2 p-4 bg-red-900 bg-opacity-50 rounded-lg border border-red-500">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {gameplaySettings.showTooltips && !gameState.feedback && (
            <div className="mb-2 p-4 rounded-lg border-2" style={{ borderColor: 'var(--retro-border)', backgroundColor: 'rgba(31, 36, 64, 0.4)' }}>
              <div className="text-cyan-200 text-sm font-semibold mb-2">STAR method quick reminder</div>
              <ul className="text-cyan-200 text-sm list-disc pl-5 space-y-1">
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
            className={`w-full ${isShowingFeedback ? 'h-24' : 'h-40'} p-4 rounded-lg text-white mb-2 placeholder-cyan-400`}
            style={{
              backgroundColor: 'var(--retro-panel)',
              border: '2px solid var(--retro-border)',
              boxShadow: 'inset 0 0 0 2px var(--retro-border-dark)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--retro-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--retro-border)'}
            placeholder="Type your answer here using the STAR method (Situation, Task, Action, Result)..."
            disabled={isLoading || isShowingFeedback}
          />
        </div>

        <button
          onClick={submitAnswer}
          disabled={
            isLoading ||
            !currentQuestionId ||
            !gameState.question ||
            !answer.trim() ||
            isShowingFeedback ||
            (!!nextAction && !shouldAutoAdvance)
          }
          className={[
            "w-full text-white text-sm font-bold py-2 px-4 rounded-lg transition-all duration-200",
            (isLoading || !currentQuestionId || !gameState.question || !answer.trim() || isShowingFeedback || (!!nextAction && !shouldAutoAdvance))
              ? "bg-gray-600 cursor-not-allowed opacity-50"
              : "transform hover:scale-105"
          ].join(" ")}
            style={!isLoading && currentQuestionId && answer.trim() && !(!!nextAction && !shouldAutoAdvance) ? {
              background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
              border: '2px solid var(--retro-border)',
              boxShadow: '0 0 0 2px var(--retro-border-dark), 0 6px 0 rgba(0, 0, 0, 0.5)'
            } : undefined}
        >
          {isLoading ? 'Submitting...' : isPracticeMode ? 'Get Feedback' : 'Submit Answer'}
        </button>

        {isShowingFeedback && (
          <div className="mt-3 text-xs text-cyan-300">
            Review your response and feedback, then continue.
          </div>
        )}

          {!shouldAutoAdvance && nextAction && (
            <button
              onClick={() => performNextAction(nextAction)}
              className="w-full mt-3 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
                border: '2px solid var(--retro-border)',
                boxShadow: '0 0 0 2px var(--retro-border-dark), 0 6px 0 rgba(0, 0, 0, 0.5)'
              }}
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
            className="text-cyan-300 hover:text-white underline"
          >
            {isPracticeMode ? 'End Practice' : 'Quit Game'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Game;
