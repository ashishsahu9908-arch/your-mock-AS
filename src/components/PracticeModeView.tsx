import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock, CheckCircle2, XCircle, HelpCircle, Lightbulb, BookOpen, Sparkles,
  RotateCcw, ChevronLeft, ChevronRight, Star, Check, Play, Pause,
  Grid, ArrowLeft, Award, Eye, EyeOff, Flag, CheckCheck,
  ExternalLink, Search
} from 'lucide-react';
import { Question, TestSetupConfig, SubjectType } from '../types';
import { MathRenderer } from './MathRenderer';
import { ImageViewerModal } from './ImageViewerModal';
import { FullscreenButton } from './FullscreenButton';
import { normalizeAnswer } from '../utils/marking';

/**
 * Standard Google 'G' icon matching brand identity
 */
const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} flex-shrink-0`} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

/**
 * Clean up question text for a readable, high-accuracy Google search query.
 * Preserves complete question text while converting LaTeX and math commands
 * into natural readable math expressions indexed by search engines.
 */
function buildGoogleSearchQuery(questionText: string): string {
  if (!questionText) return '';

  let text = questionText;

  // Remove HTML tags if present
  text = text.replace(/<[^>]*>/g, ' ');

  // Common LaTeX math conversions to readable text
  text = text.replace(/\\text\{([^}]+)\}/g, '$1');
  text = text.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  text = text.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
  text = text.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  text = text.replace(/\\times/g, '*');
  text = text.replace(/\\cdot/g, '*');
  text = text.replace(/\\pm/g, '±');
  text = text.replace(/\\leq/g, '<=');
  text = text.replace(/\\geq/g, '>=');
  text = text.replace(/\\neq/g, '!=');
  text = text.replace(/\\degree/g, '°');
  text = text.replace(/\\circ/g, '°');
  text = text.replace(/\\rightarrow/g, '->');
  text = text.replace(/\\implies/g, '=>');
  text = text.replace(/\\int/g, 'integral');
  text = text.replace(/\\sum/g, 'sum');

  // Strip dollar signs used for LaTeX math delimiters ($...$ or $$...$$)
  text = text.replace(/\$+/g, '');

  // Strip remaining backslash LaTeX symbols (\alpha -> alpha)
  text = text.replace(/\\([a-zA-Z]+)/g, '$1');

  // Clean curly braces remaining from LaTeX formatting
  text = text.replace(/[{}]/g, '');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

interface PracticeModeViewProps {
  testConfig: TestSetupConfig;
  onExit: () => void;
  onSwitchToCbtExam?: () => void;
}

interface QuestionPracticeState {
  userAnswer: string | string[];
  isChecked: boolean;
  isCorrect?: boolean;
  isFlagged?: boolean;
  showSolution?: boolean;
  timeSpentSeconds: number;
}

export const PracticeModeView: React.FC<PracticeModeViewProps> = ({
  testConfig,
  onExit,
  onSwitchToCbtExam,
}) => {
  const { questions, testName } = testConfig;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<string>('All');
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);

  // Stopwatch timer state
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Per-question practice state
  const [practiceStates, setPracticeStates] = useState<Record<string, QuestionPracticeState>>(() => {
    const initial: Record<string, QuestionPracticeState> = {};
    questions.forEach((q) => {
      initial[q.id] = {
        userAnswer: q.type === 'multi_choice' ? [] : '',
        isChecked: false,
        timeSpentSeconds: 0,
        showSolution: false,
        isFlagged: false,
      };
    });
    return initial;
  });

  // Zoom modal state
  const [zoomModal, setZoomModal] = useState<{
    isOpen: boolean;
    imageUrl?: string;
    svgContent?: string;
    title?: string;
    caption?: string;
  }>({ isOpen: false });

  const currentQuestion = questions[currentIndex] || questions[0];
  const currentState = practiceStates[currentQuestion.id] || {
    userAnswer: '',
    isChecked: false,
    timeSpentSeconds: 0,
    showSolution: false,
  };

  // Stopwatch effect
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setPracticeStates((prev) => {
          const qId = questions[currentIndex]?.id;
          if (!qId) return prev;
          const curr = prev[qId] || { userAnswer: '', isChecked: false, timeSpentSeconds: 0 };
          return {
            ...prev,
            [qId]: {
              ...curr,
              timeSpentSeconds: curr.timeSpentSeconds + 1,
            },
          };
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, currentIndex, questions]);

  // Derived subjects
  const subjects = useMemo(() => {
    const list = Array.from(new Set(questions.map((q) => q.subject || 'General')));
    return ['All', ...list];
  }, [questions]);

  // Questions filtered by subject tab
  const displayedQuestions = useMemo(() => {
    if (selectedSubjectTab === 'All') return questions;
    return questions.filter((q) => (q.subject || 'General') === selectedSubjectTab);
  }, [questions, selectedSubjectTab]);

  // Format stopwatch time
  const formatStopwatch = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  // Option selection
  const handleOptionClick = (optionId: string) => {
    if (currentState.isChecked) return; // Prevent changing after checked unless reset

    const qId = currentQuestion.id;
    if (currentQuestion.type === 'multi_choice') {
      const current = Array.isArray(currentState.userAnswer)
        ? (currentState.userAnswer as string[])
        : currentState.userAnswer
        ? [currentState.userAnswer as string]
        : [];
      const exists = current.includes(optionId);
      const next = exists ? current.filter((id) => id !== optionId) : [...current, optionId].sort();
      setPracticeStates((prev) => ({
        ...prev,
        [qId]: { ...prev[qId], userAnswer: next },
      }));
    } else {
      setPracticeStates((prev) => ({
        ...prev,
        [qId]: { ...prev[qId], userAnswer: optionId },
      }));
    }
  };

  // Check Answer
  const handleCheckAnswer = () => {
    const qId = currentQuestion.id;
    const userNormalized = normalizeAnswer(currentState.userAnswer);
    const correctNormalized = normalizeAnswer(currentQuestion.correctAnswer);

    let isCorrect = false;
    if (currentQuestion.type === 'numerical') {
      const uVal = parseFloat(userNormalized[0] || '');
      const cVal = parseFloat(correctNormalized[0] || '');
      if (!isNaN(uVal) && !isNaN(cVal)) {
        isCorrect = Math.abs(uVal - cVal) < 0.01;
      } else {
        isCorrect = userNormalized[0] === correctNormalized[0];
      }
    } else if (currentQuestion.type === 'multi_choice') {
      isCorrect =
        userNormalized.length === correctNormalized.length &&
        userNormalized.every((val, idx) => val === correctNormalized[idx]);
    } else {
      isCorrect = userNormalized[0] === correctNormalized[0];
    }

    setPracticeStates((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        isChecked: true,
        isCorrect,
        showSolution: true, // auto reveal solution on check
      },
    }));
  };

  // Reset current question
  const handleResetQuestion = () => {
    const qId = currentQuestion.id;
    setPracticeStates((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        userAnswer: currentQuestion.type === 'multi_choice' ? [] : '',
        isChecked: false,
        isCorrect: undefined,
        showSolution: false,
      },
    }));
  };

  // Toggle show solution
  const handleToggleSolution = () => {
    const qId = currentQuestion.id;
    setPracticeStates((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        showSolution: !prev[qId].showSolution,
      },
    }));
  };

  // Toggle flag for revision
  const handleToggleFlag = () => {
    const qId = currentQuestion.id;
    setPracticeStates((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        isFlagged: !prev[qId].isFlagged,
      },
    }));
  };

  // Single-click Google search for exact question text
  const handleSearchOnGoogle = () => {
    if (!currentQuestion || !currentQuestion.questionText) return;
    const query = buildGoogleSearchQuery(currentQuestion.questionText);
    if (!query) return;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  };

  // Navigation
  const navigateTo = (idx: number) => {
    if (idx >= 0 && idx < questions.length) {
      setCurrentIndex(idx);
      setIsPaletteOpenMobile(false);
    }
  };

  // Summary counts
  const summary = useMemo(() => {
    let checkedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let flaggedCount = 0;

    (Object.values(practiceStates) as QuestionPracticeState[]).forEach((st) => {
      if (st.isChecked) {
        checkedCount++;
        if (st.isCorrect) correctCount++;
        else incorrectCount++;
      }
      if (st.isFlagged) flaggedCount++;
    });

    const accuracy = checkedCount > 0 ? Math.round((correctCount / checkedCount) * 100) : 0;

    return {
      total: questions.length,
      checkedCount,
      correctCount,
      incorrectCount,
      flaggedCount,
      accuracy,
    };
  }, [practiceStates, questions.length]);

  const hasAnswerSelected = Array.isArray(currentState.userAnswer)
    ? currentState.userAnswer.length > 0
    : Boolean(currentState.userAnswer && currentState.userAnswer.toString().trim());

  const currentAnswerArray = Array.isArray(currentState.userAnswer)
    ? currentState.userAnswer
    : currentState.userAnswer
    ? [currentState.userAnswer]
    : [];

  const correctAnswersArray = Array.isArray(currentQuestion.correctAnswer)
    ? currentQuestion.correctAnswer
    : [currentQuestion.correctAnswer];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col select-none">
      {/* 1. Practice Mode Header Bar */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 text-white font-black text-xs shadow-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>PRACTICE</span>
          </div>

          <div>
            <h1 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 max-w-[170px] sm:max-w-xs md:max-w-md">
              {testName}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
              <span className="text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">
                Instant Solution Mode
              </span>
              <span>•</span>
              <span>Q {currentIndex + 1} of {questions.length}</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Stopwatch, Stats, Fullscreen & Exit */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Practice Stopwatch */}
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black border bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700"
            title="Practice Time Elapsed"
          >
            <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{formatStopwatch(elapsedSeconds)}</span>
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
            </button>
          </div>

          {/* Quick Score Badge */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-900 text-xs font-bold text-teal-700 dark:text-teal-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{summary.correctCount} / {summary.checkedCount}</span>
            {summary.checkedCount > 0 && (
              <span className="text-[10px] opacity-75">({summary.accuracy}%)</span>
            )}
          </div>

          {/* Fullscreen Button in Header (Requested Feature) */}
          <FullscreenButton showLabel={false} id="practice-fullscreen-btn" />

          {/* Finish Practice Button */}
          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            className="px-3 sm:px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs sm:text-sm font-bold hover:bg-teal-700 shadow-sm shadow-teal-600/30 flex items-center gap-1.5 transition-colors"
          >
            <Award className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Summary</span>
          </button>

          {/* Exit Button */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Exit Practice"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Mobile Palette Button */}
          <button
            type="button"
            onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
            className="lg:hidden w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Practice Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-2 sm:p-4 gap-4 overflow-hidden">
        {/* Left: Main Question & Interactive Solution Panel */}
        <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Question Header & Subject Navigation */}
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-black text-xs">
                Question {currentQuestion.questionNumber}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {currentQuestion.subject}
              </span>
              {currentQuestion.sectionName && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                  {currentQuestion.sectionName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Star / Flag for Revision */}
              <button
                type="button"
                onClick={handleToggleFlag}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  currentState.isFlagged
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border-amber-300 dark:border-amber-800'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-amber-500'
                }`}
                title="Flag this question for revision"
              >
                <Star className={`w-3.5 h-3.5 ${currentState.isFlagged ? 'fill-current' : ''}`} />
                <span>{currentState.isFlagged ? 'Flagged' : 'Flag'}</span>
              </button>

              {/* Reset Question Button */}
              {currentState.isChecked && (
                <button
                  type="button"
                  onClick={handleResetQuestion}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Try answering again"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>

          {/* Question Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Question Text */}
            <div className="text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-relaxed font-normal">
              <MathRenderer content={currentQuestion.questionText} />
            </div>

            {/* Embedded SVG Diagram if exists */}
            {currentQuestion.diagramSvg && (
              <div className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                <div
                  className="max-w-full overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.diagramSvg }}
                />
                {currentQuestion.diagramDescription && (
                  <p className="mt-2 text-xs text-slate-500 text-center italic">
                    {currentQuestion.diagramDescription}
                  </p>
                )}
              </div>
            )}

            {/* Image attachment if exists */}
            {currentQuestion.imageUrl && (
              <div className="my-4 inline-block">
                <div
                  onClick={() =>
                    setZoomModal({
                      isOpen: true,
                      imageUrl: currentQuestion.imageUrl,
                      title: `Question ${currentQuestion.questionNumber} Diagram`,
                    })
                  }
                  className="group relative cursor-pointer inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Question ${currentQuestion.questionNumber}`}
                    className="max-h-60 max-w-full object-contain rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-bold gap-1">
                    <span>Click to zoom</span>
                  </div>
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="space-y-3 pt-2">
              {currentQuestion.type !== 'numerical' && (
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {currentQuestion.type === 'multi_choice'
                    ? 'Select all correct options (Multiple Choice)'
                    : 'Choose the correct option:'}
                </div>
              )}

              {/* Single / Multi Choice Options */}
              {currentQuestion.options && currentQuestion.options.length > 0 ? (
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentAnswerArray.includes(opt.id);
                    const isCorrectAnswer = correctAnswersArray.includes(opt.id);

                    // Color logic for checked state vs uncheck state
                    let optionStyle = 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 bg-white dark:bg-slate-900';
                    let badgeStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';

                    if (currentState.isChecked) {
                      if (isCorrectAnswer) {
                        // Correct option is always green after checking
                        optionStyle = 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100';
                        badgeStyle = 'bg-emerald-600 text-white';
                      } else if (isSelected && !isCorrectAnswer) {
                        // User chose wrong option
                        optionStyle = 'border-red-500 bg-red-50/70 dark:bg-red-950/40 text-red-950 dark:text-red-100';
                        badgeStyle = 'bg-red-600 text-white';
                      }
                    } else if (isSelected) {
                      optionStyle = 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100';
                      badgeStyle = 'bg-teal-600 text-white';
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleOptionClick(opt.id)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${optionStyle}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${badgeStyle}`}
                        >
                          {currentState.isChecked && isCorrectAnswer ? (
                            <Check className="w-4 h-4" />
                          ) : currentState.isChecked && isSelected && !isCorrectAnswer ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            opt.id
                          )}
                        </div>

                        <div className="flex-1 text-sm font-medium pt-0.5">
                          <MathRenderer content={opt.text} />
                        </div>

                        {currentState.isChecked && isCorrectAnswer && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 self-center">
                            <CheckCheck className="w-3.5 h-3.5" /> Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Numerical Answer Input */
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 max-w-sm space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Enter Numerical Value:
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={currentState.isChecked}
                    value={(currentState.userAnswer as string) || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPracticeStates((prev) => ({
                        ...prev,
                        [currentQuestion.id]: { ...prev[currentQuestion.id], userAnswer: val },
                      }));
                    }}
                    placeholder="Type integer or decimal..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {currentState.isChecked && (
                    <div className="text-xs font-bold pt-1">
                      {currentState.isCorrect ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Correct Answer: {currentQuestion.correctAnswer}
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Correct answer is: {currentQuestion.correctAnswer}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Banner after Checking */}
              {currentState.isChecked && (
                <div
                  className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
                    currentState.isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  {currentState.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1">
                    <div className="font-bold text-sm">
                      {currentState.isCorrect ? 'Well done! Correct Answer.' : 'Incorrect Attempt.'}
                    </div>
                    <div className="text-xs mt-0.5">
                      {currentState.isCorrect ? (
                        <span>You selected the right option. Review the detailed solution below.</span>
                      ) : (
                        <span>
                          The correct answer is{' '}
                          <strong className="font-mono">
                            {Array.isArray(currentQuestion.correctAnswer)
                              ? currentQuestion.correctAnswer.join(', ')
                              : currentQuestion.correctAnswer}
                          </strong>
                          . Check the explanation below to understand the concept.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* DPP Solution & Google Search Section */}
              <div className="mt-6 space-y-4">
                {/* Detailed DPP Solution Block */}
                {currentState.showSolution && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1.5 border border-amber-200 dark:border-amber-800">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>DPP Solution</span>
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline font-medium">
                          Step-by-step explanation
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleSolution}
                        className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </button>
                    </div>

                    {currentQuestion.solution ? (
                      <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal bg-white dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <MathRenderer content={currentQuestion.solution} />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic bg-white dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        DPP solution text is not explicitly provided in the source DPP. The verified answer key is{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {Array.isArray(currentQuestion.correctAnswer)
                            ? currentQuestion.correctAnswer.join(', ')
                            : currentQuestion.correctAnswer}
                        </strong>
                        .
                      </div>
                    )}

                    {/* Solution SVG Diagram if present */}
                    {currentQuestion.solutionSvg && (
                      <div className="pt-2">
                        <div
                          className="max-w-full overflow-x-auto p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
                          dangerouslySetInnerHTML={{ __html: currentQuestion.solutionSvg }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Visible Action Buttons: DPP Solution & Search Solution on Google */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {!currentState.showSolution && (
                    <button
                      type="button"
                      id="view-dpp-solution-btn"
                      onClick={handleToggleSolution}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                      title="Show detailed DPP solution"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>DPP Solution</span>
                    </button>
                  )}

                  {/* Search Solution on Google - Always visible for every question in Practice Mode */}
                  <button
                    type="button"
                    id="search-solution-google-btn"
                    onClick={handleSearchOnGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 font-bold text-xs sm:text-sm shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Open Google search for this exact question in a new tab"
                  >
                    <GoogleIcon />
                    <span>Search Solution on Google</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Control Bar */}
          <div className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
            {/* Left Nav */}
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => navigateTo(currentIndex - 1)}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Center: Check Answer / Solution Buttons */}
            <div className="flex items-center gap-2">
              {!currentState.isChecked && (
                <button
                  type="button"
                  disabled={!hasAnswerSelected}
                  onClick={handleCheckAnswer}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Check Answer</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleSolution}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
              >
                {currentState.showSolution ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Hide Solution</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>View Solution</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Nav */}
            <button
              type="button"
              disabled={currentIndex === questions.length - 1}
              onClick={() => navigateTo(currentIndex + 1)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 flex items-center gap-1 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        {/* Right: Question Palette Sidebar */}
        <aside
          className={`lg:w-80 w-full flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden ${
            isPaletteOpenMobile ? 'fixed inset-4 z-50 overflow-y-auto' : 'hidden lg:flex'
          }`}
        >
          {/* Palette Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Grid className="w-4 h-4 text-teal-600" />
              <span>Question Palette</span>
            </h2>

            {isPaletteOpenMobile && (
              <button
                type="button"
                onClick={() => setIsPaletteOpenMobile(false)}
                className="lg:hidden p-1 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            )}
          </div>

          {/* Subject Filter Tabs */}
          {subjects.length > 2 && (
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1 overflow-x-auto">
              {subjects.map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSelectedSubjectTab(subj)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                    selectedSubjectTab === subj
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          )}

          {/* Palette Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const st = practiceStates[q.id];
                const isCurrent = idx === currentIndex;

                // Color code based on practice state
                let cellClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                if (st?.isChecked) {
                  if (st.isCorrect) {
                    cellClass = 'bg-emerald-500 text-white border-emerald-600';
                  } else {
                    cellClass = 'bg-red-500 text-white border-red-600';
                  }
                } else if (
                  Array.isArray(st?.userAnswer)
                    ? st.userAnswer.length > 0
                    : Boolean(st?.userAnswer)
                ) {
                  cellClass = 'bg-teal-500 text-white border-teal-600';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigateTo(idx)}
                    className={`relative h-10 rounded-xl font-mono text-xs font-bold border transition-all flex items-center justify-center ${cellClass} ${
                      isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-105' : 'hover:opacity-85'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {st?.isFlagged && (
                      <Star className="w-2.5 h-2.5 absolute top-1 right-1 fill-amber-300 text-amber-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500" />
                <span>Correct Answer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-red-500" />
                <span>Incorrect Attempt</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-teal-500" />
                <span>Answered (Unchecked)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-200 dark:bg-slate-700" />
                <span>Not Attempted</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Flagged for Revision</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  Practice Summary
                </h3>
                <p className="text-xs text-slate-500">
                  {testName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center pt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {summary.checkedCount} / {summary.total}
                </div>
                <div className="text-[11px] text-slate-500">Attempted</div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800">
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {summary.correctCount}
                </div>
                <div className="text-[11px] text-emerald-600">Correct</div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800">
                <div className="text-lg font-black text-teal-600 dark:text-teal-400">
                  {summary.accuracy}%
                </div>
                <div className="text-[11px] text-teal-600">Accuracy</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Time Spent:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatStopwatch(elapsedSeconds)}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Continue Practicing
              </button>

              <button
                type="button"
                onClick={onExit}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-sm"
              >
                Finish & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Exit Practice Mode?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You can return to the test library or switch to CBT Mock Exam anytime.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Keep Practicing
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700"
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Modal for Diagrams */}
      <ImageViewerModal
        isOpen={zoomModal.isOpen}
        onClose={() => setZoomModal({ isOpen: false })}
        imageUrl={zoomModal.imageUrl}
        svgContent={zoomModal.svgContent}
        title={zoomModal.title}
        caption={zoomModal.caption}
      />
    </div>
  );
};
