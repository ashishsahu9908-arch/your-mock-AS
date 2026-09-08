import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Clock, AlertTriangle, ChevronLeft, ChevronRight, Check, RotateCcw, 
  Bookmark, Send, Grid, Menu, X, ArrowRight, ShieldAlert, CheckCircle2,
  HelpCircle, Sparkles, Timer, ZoomIn
} from 'lucide-react';
import { Question, QuestionStatus, TestSetupConfig, TestResult } from '../types';
import { MathRenderer } from './MathRenderer';
import { calculateTestResult } from '../utils/marking';
import { StorageService, ActiveSessionData } from '../utils/storage';
import { ImageViewerModal } from './ImageViewerModal';
import { FullscreenButton } from './FullscreenButton';

interface JeeTestInterfaceProps {
  testConfig: TestSetupConfig;
  onFinishTest: (result: TestResult) => void;
  onExitTest: () => void;
}

export const JeeTestInterface: React.FC<JeeTestInterfaceProps> = ({
  testConfig,
  onFinishTest,
  onExitTest,
}) => {
  const { questions, markingScheme, durationMinutes, testId, testName } = testConfig;

  // Initialize or restore session state
  const initialData = useMemo(() => {
    const existing = StorageService.getActiveSession();
    if (existing && existing.testConfig.testId === testId) {
      return existing;
    }

    const defaultStatuses: Record<string, QuestionStatus> = {};
    const defaultResponses: Record<string, string | string[]> = {};
    const defaultTimeSpent: Record<string, number> = {};

    questions.forEach((q, idx) => {
      defaultStatuses[q.id] = idx === 0 ? 'unanswered' : 'not_visited';
      defaultResponses[q.id] = '';
      defaultTimeSpent[q.id] = 0;
    });

    return {
      testConfig,
      responses: defaultResponses,
      statuses: defaultStatuses,
      timeSpentPerQuestion: defaultTimeSpent,
      startedAt: Date.now(),
      initialDurationMinutes: durationMinutes,
      remainingSeconds: durationMinutes * 60,
      lastActiveTimestamp: Date.now(),
      currentQuestionIndex: 0,
    } as ActiveSessionData;
  }, [testId, testConfig, questions, durationMinutes]);

  const [currentIndex, setCurrentIndex] = useState<number>(initialData.currentQuestionIndex || 0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>(initialData.responses);
  const [statuses, setStatuses] = useState<Record<string, QuestionStatus>>(initialData.statuses);
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>(initialData.timeSpentPerQuestion);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialData.remainingSeconds);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState<boolean>(false);
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<string>('All');
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const currentQuestion = questions[currentIndex] || questions[0];

  const [zoomModal, setZoomModal] = useState<{
    isOpen: boolean;
    imageUrl?: string;
    svgContent?: string;
    title?: string;
    caption?: string;
  }>({ isOpen: false });

  const currentQuestionTime = (currentQuestion && timeSpent[currentQuestion.id]) || 0;

  // Derive available subject sections
  const subjects = useMemo(() => {
    const list = Array.from(new Set(questions.map((q) => q.subject || 'General')));
    return ['All', ...list];
  }, [questions]);

  // Questions filtered by subject tab
  const displayedQuestions = useMemo(() => {
    if (selectedSubjectTab === 'All') return questions;
    return questions.filter((q) => (q.subject || 'General') === selectedSubjectTab);
  }, [questions, selectedSubjectTab]);

  // Save state continuously to local storage
  useEffect(() => {
    StorageService.saveActiveSession({
      testConfig,
      responses,
      statuses,
      timeSpentPerQuestion: timeSpent,
      startedAt: initialData.startedAt,
      initialDurationMinutes: durationMinutes,
      remainingSeconds,
      lastActiveTimestamp: Date.now(),
      currentQuestionIndex: currentIndex,
    });
  }, [testConfig, responses, statuses, timeSpent, remainingSeconds, currentIndex, initialData.startedAt, durationMinutes]);

  // Accurate countdown timer based on wall clock diff
  useEffect(() => {
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      if (elapsed > 0) {
        // Increment time spent on the active question
        setTimeSpent((prev) => {
          const qId = questions[currentIndex]?.id;
          if (!qId) return prev;
          return {
            ...prev,
            [qId]: (prev[qId] || 0) + elapsed,
          };
        });

        // Decrement remaining test timer
        setRemainingSeconds((prev) => {
          const next = prev - elapsed;
          if (next <= 0) {
            clearInterval(timerRef.current!);
            handleTimeExpired();
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, questions]);

  // Trigger auto submit when time expires
  const handleTimeExpired = () => {
    setIsTimeUp(true);
    setIsAutoSubmitting(true);
    setShowSubmitModal(false);

    // Auto submit after a 2-second alert banner
    setTimeout(() => {
      submitFinalTest(true);
    }, 2000);
  };

  // Calculate and dispatch test result
  const submitFinalTest = (isAutoSubmitted: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const totalTimeUsedSeconds = Math.max(0, durationMinutes * 60 - remainingSeconds);

    const result = calculateTestResult(
      testId,
      testName,
      durationMinutes,
      totalTimeUsedSeconds,
      markingScheme,
      questions,
      responses,
      timeSpent,
      isAutoSubmitted
    );

    // Save to test history
    StorageService.saveResult(result);
    // Clear active session
    StorageService.clearActiveSession();

    onFinishTest(result);
  };

  // Format countdown time HH : MM : SS
  const formatTime = (secs: number) => {
    const clamped = Math.max(0, secs);
    const h = Math.floor(clamped / 3600);
    const m = Math.floor((clamped % 3600) / 60);
    const s = clamped % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  };

  // Option selection handling
  const handleOptionSelect = (optionId: string) => {
    if (isTimeUp) return;

    const qId = currentQuestion.id;
    if (currentQuestion.type === 'multi_choice') {
      const current = Array.isArray(responses[qId])
        ? (responses[qId] as string[])
        : responses[qId]
        ? [responses[qId] as string]
        : [];
      const exists = current.includes(optionId);
      const next = exists ? current.filter((id) => id !== optionId) : [...current, optionId].sort();
      setResponses((prev) => ({ ...prev, [qId]: next }));
    } else {
      setResponses((prev) => ({ ...prev, [qId]: optionId }));
    }
  };

  // Clear current question response
  const handleClearResponse = () => {
    if (isTimeUp) return;
    const qId = currentQuestion.id;
    setResponses((prev) => ({ ...prev, [qId]: '' }));

    // Reset status to unanswered or not visited
    setStatuses((prev) => {
      const curStatus = prev[qId];
      if (curStatus === 'answered_and_marked_for_review') {
        return { ...prev, [qId]: 'marked_for_review' };
      }
      return { ...prev, [qId]: 'unanswered' };
    });
  };

  // Save & Next
  const handleSaveAndNext = () => {
    if (isTimeUp) return;
    const qId = currentQuestion.id;
    const answer = responses[qId];
    const hasAnswer = Array.isArray(answer) ? answer.length > 0 : Boolean(answer && answer.toString().trim());

    setStatuses((prev) => ({
      ...prev,
      [qId]: hasAnswer ? 'answered' : 'unanswered',
    }));

    if (currentIndex < questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  };

  // Mark for Review & Next
  const handleMarkForReviewAndNext = () => {
    if (isTimeUp) return;
    const qId = currentQuestion.id;
    const answer = responses[qId];
    const hasAnswer = Array.isArray(answer) ? answer.length > 0 : Boolean(answer && answer.toString().trim());

    setStatuses((prev) => ({
      ...prev,
      [qId]: hasAnswer ? 'answered_and_marked_for_review' : 'marked_for_review',
    }));

    if (currentIndex < questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  };

  // Navigate to specific question index
  const navigateToQuestion = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    // If current was not visited, mark as unanswered
    const currentQId = currentQuestion.id;
    const currentAnswer = responses[currentQId];
    const hasAnswer = Array.isArray(currentAnswer)
      ? currentAnswer.length > 0
      : Boolean(currentAnswer && currentAnswer.toString().trim());

    setStatuses((prev) => {
      const currentStat = prev[currentQId];
      if (currentStat === 'not_visited') {
        return {
          ...prev,
          [currentQId]: hasAnswer ? 'answered' : 'unanswered',
        };
      }
      return prev;
    });

    // Mark target as visited (if was not visited)
    const targetQId = questions[targetIndex].id;
    setStatuses((prev) => {
      if (prev[targetQId] === 'not_visited') {
        return { ...prev, [targetQId]: 'unanswered' };
      }
      return prev;
    });

    setCurrentIndex(targetIndex);
    setIsPaletteOpenMobile(false);
  };

  // Summary counts for palette & submission dialog
  const summaryCounts = useMemo(() => {
    let answered = 0;
    let unanswered = 0;
    let notVisited = 0;
    let markedForReview = 0;
    let answeredAndMarked = 0;

    questions.forEach((q) => {
      const stat = statuses[q.id] || 'not_visited';
      if (stat === 'answered') answered++;
      else if (stat === 'unanswered') unanswered++;
      else if (stat === 'not_visited') notVisited++;
      else if (stat === 'marked_for_review') markedForReview++;
      else if (stat === 'answered_and_marked_for_review') answeredAndMarked++;
    });

    return {
      answered,
      unanswered,
      notVisited,
      markedForReview,
      answeredAndMarked,
      totalAttempted: answered + answeredAndMarked,
      totalUnattempted: unanswered + notVisited + markedForReview,
    };
  }, [questions, statuses]);

  // Current answer representation
  const currentAnswer = responses[currentQuestion.id] || '';
  const currentAnswerArray = Array.isArray(currentAnswer) ? currentAnswer : currentAnswer ? [currentAnswer] : [];

  // Low time warning threshold (< 5 minutes amber, < 1 minute pulsing red)
  const isTimeCritical = remainingSeconds <= 60;
  const isTimeWarning = remainingSeconds <= 300 && remainingSeconds > 60;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col select-none">
      {/* 1. Exam Header Bar */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
            JEE
          </div>
          <div>
            <h1 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 max-w-[180px] sm:max-w-md">
              {testName}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              <span>{testConfig.markingPattern.replace('_', ' ')} PATTERN</span>
              <span>•</span>
              <span>Q {currentIndex + 1} / {questions.length}</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Timers & Submit */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Total Countdown timer */}
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black border transition-all ${
              isTimeCritical
                ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse'
                : isTimeWarning
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700'
            }`}
            title="Total Test Time Remaining"
          >
            <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold hidden md:inline leading-none">Total</span>
              <span>{formatTime(remainingSeconds)}</span>
            </div>
          </div>

          {/* Current Question Live Timer */}
          <div 
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black border bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
            title={`Time spent on Question ${currentQuestion.questionNumber}`}
          >
            <Timer className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase tracking-wider text-blue-500/90 dark:text-blue-400 font-bold hidden md:inline leading-none">Q{currentQuestion.questionNumber}</span>
              <span>{formatTime(currentQuestionTime)}</span>
            </div>
          </div>

          {/* Fullscreen Toggle Button */}
          <FullscreenButton id="jee-fullscreen-btn" showLabel={false} />

          {/* Submit Test Button */}
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Submit Test</span>
            <span className="sm:hidden">Submit</span>
          </button>

          {/* Mobile Palette Toggle Button */}
          <button
            onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
            className="lg:hidden w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Time Expired / Auto-Submitting Overlay Banner */}
      {isTimeUp && (
        <div className="bg-red-600 text-white px-4 py-3 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 animate-bounce">
          <AlertTriangle className="w-4 h-4" />
          <span>Time is Up! Your test is being automatically submitted...</span>
        </div>
      )}

      {/* 2. Main Test Body (Question Area + Question Palette) */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-2 sm:p-4 gap-4 overflow-hidden">
        {/* Left / Main Question Workspace */}
        <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Section tabs & Question type badge */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30">
            {/* Subject Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {subjects.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubjectTab(sub)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    selectedSubjectTab === sub
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* Marking Scheme Badge */}
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                +4.00
              </span>
              <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                {testConfig.markingPattern === 'jee_advanced' ? '-2.00' : '-1.00'}
              </span>
              {testConfig.markingPattern === 'jee_advanced' && currentQuestion.type === 'multi_choice' && (
                <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  Partial +2.00
                </span>
              )}
            </div>
          </div>

          {/* Question Content Scroll Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
            {/* Question Heading */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Question {currentQuestion.questionNumber}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {currentQuestion.subject}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  {currentQuestion.type === 'multi_choice'
                    ? 'One or More Correct (Partial Marking)'
                    : currentQuestion.type === 'numerical'
                    ? 'Numerical Value'
                    : 'Single Correct MCQ'}
                </span>
              </div>

              {/* Per-Question Live Stopwatch Display */}
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold"
                title={`Accumulated time on Question ${currentQuestion.questionNumber}`}
              >
                <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Time on Question: {formatTime(currentQuestionTime)}</span>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-base sm:text-lg">
              <MathRenderer content={currentQuestion.questionText} />
            </div>

            {/* Extracted / Attached Question Image */}
            {currentQuestion.imageUrl && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-lg mx-auto text-center space-y-2">
                <div className="relative group inline-block overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Question ${currentQuestion.questionNumber} Diagram`}
                    className="max-h-72 w-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <button
                    onClick={() =>
                      setZoomModal({
                        isOpen: true,
                        imageUrl: currentQuestion.imageUrl,
                        title: `Question ${currentQuestion.questionNumber} Diagram`,
                        caption: currentQuestion.diagramDescription,
                      })
                    }
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md transition-opacity"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoom Image</span>
                  </button>
                </div>
                {currentQuestion.diagramDescription && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {currentQuestion.diagramDescription}
                  </p>
                )}
              </div>
            )}

            {/* Inline SVG Diagram */}
            {currentQuestion.diagramSvg && !currentQuestion.imageUrl && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-md mx-auto text-center space-y-2">
                <div 
                  className="cursor-zoom-in [&>svg]:max-w-full [&>svg]:h-auto mx-auto"
                  onClick={() =>
                    setZoomModal({
                      isOpen: true,
                      svgContent: currentQuestion.diagramSvg,
                      title: `Question ${currentQuestion.questionNumber} Diagram`,
                      caption: currentQuestion.diagramDescription,
                    })
                  }
                  dangerouslySetInnerHTML={{ __html: currentQuestion.diagramSvg }} 
                />
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="italic">{currentQuestion.diagramDescription || 'Schematic Diagram'}</span>
                  <button
                    onClick={() =>
                      setZoomModal({
                        isOpen: true,
                        svgContent: currentQuestion.diagramSvg,
                        title: `Question ${currentQuestion.questionNumber} Diagram`,
                        caption: currentQuestion.diagramDescription,
                      })
                    }
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>Zoom In</span>
                  </button>
                </div>
              </div>
            )}

            {currentQuestion.diagramDescription && !currentQuestion.diagramSvg && !currentQuestion.imageUrl && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
                <span className="font-bold">Figure / Diagram Note:</span> {currentQuestion.diagramDescription}
              </div>
            )}

            {/* Options or Numerical Input */}
            {currentQuestion.type !== 'numerical' ? (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Options {currentQuestion.type === 'multi_choice' ? '(Select all correct options)' : ''}:
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentAnswerArray.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs ring-1 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {opt.id}
                        </div>

                        <div className="flex-1 text-sm sm:text-base pt-0.5">
                          <MathRenderer content={opt.text} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Numerical Answer Input */
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 max-w-md space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Enter Your Numerical Answer (Integers or Decimals):
                </label>
                <input
                  type="text"
                  disabled={isTimeUp}
                  value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setResponses((prev) => ({ ...prev, [currentQuestion.id]: val }));
                  }}
                  placeholder="e.g. 12 or 3.5 or -4"
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-base font-bold text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  Use the minus sign '-' for negative answers if applicable.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Action Bar (JEE standard CBT controls) */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearResponse}
                disabled={isTimeUp || currentAnswerArray.length === 0}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Response</span>
                <span className="sm:hidden">Clear</span>
              </button>

              <button
                onClick={handleMarkForReviewAndNext}
                disabled={isTimeUp}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Mark for Review & Next</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <button
                onClick={() => navigateToQuestion(currentIndex + 1)}
                disabled={currentIndex === questions.length - 1}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleSaveAndNext}
                disabled={isTimeUp}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>

        {/* Right / Question Palette Panel (Desktop + Mobile Drawer) */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-40 w-80 lg:w-72 bg-white dark:bg-slate-900 border-l lg:border border-slate-200 dark:border-slate-800 lg:rounded-2xl p-4 flex flex-col shadow-xl lg:shadow-xs transition-transform duration-300 ${
            isPaletteOpenMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Palette Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Question Palette
              </h2>
            </div>
            <button
              onClick={() => setIsPaletteOpenMobile(false)}
              className="lg:hidden w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Palette Legend */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {summaryCounts.answered}
              </span>
              <span>Answered</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-red-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {summaryCounts.unanswered}
              </span>
              <span>Not Answered</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {summaryCounts.markedForReview}
              </span>
              <span>Marked Review</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center relative flex-shrink-0">
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
                {summaryCounts.answeredAndMarked}
              </span>
              <span>Ans & Review</span>
            </div>

            <div className="flex items-center gap-1.5 col-span-2">
              <span className="w-4 h-4 rounded-md bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {summaryCounts.notVisited}
              </span>
              <span>Not Visited</span>
            </div>
          </div>

          {/* Question Grid */}
          <div className="flex-1 py-3 overflow-y-auto">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const stat = statuses[q.id] || 'not_visited';
                const isCurrent = idx === currentIndex;

                let btnBg = 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
                if (stat === 'answered') {
                  btnBg = 'bg-emerald-600 text-white';
                } else if (stat === 'unanswered') {
                  btnBg = 'bg-red-600 text-white';
                } else if (stat === 'marked_for_review') {
                  btnBg = 'bg-purple-600 text-white';
                } else if (stat === 'answered_and_marked_for_review') {
                  btnBg = 'bg-purple-600 text-white';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => navigateToQuestion(idx)}
                    className={`h-9 rounded-xl text-xs font-bold transition-all relative flex items-center justify-center ${btnBg} ${
                      isCurrent
                        ? 'ring-3 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-105 z-10'
                        : 'hover:opacity-90'
                    }`}
                  >
                    {q.questionNumber}
                    {stat === 'answered_and_marked_for_review' && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-white dark:border-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Palette Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Examination</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Drawer Backdrop */}
      {isPaletteOpenMobile && (
        <div
          onClick={() => setIsPaletteOpenMobile(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* 3. Confirmation Dialog on Test Submit */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Confirm Examination Submission
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to finish and submit your test?
                </p>
              </div>
            </div>

            {/* Status Statistics Table */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Attempted Questions:</span>
                <span className="font-black text-emerald-600">{summaryCounts.totalAttempted}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Unattempted Questions:</span>
                <span className="font-black text-red-500">{summaryCounts.totalUnattempted}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Marked for Review:</span>
                <span className="font-black text-purple-600">{summaryCounts.markedForReview + summaryCounts.answeredAndMarked}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Remaining Time:</span>
                <span className="font-black text-blue-600 font-mono">{formatTime(remainingSeconds)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Marking Pattern:</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">
                  {testConfig.markingPattern.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Return to Test
              </button>

              <button
                onClick={() => submitFinalTest(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-black hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Yes, Submit Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Diagram / Image Zoom Modal */}
      <ImageViewerModal
        isOpen={zoomModal.isOpen}
        imageUrl={zoomModal.imageUrl}
        svgContent={zoomModal.svgContent}
        title={zoomModal.title}
        caption={zoomModal.caption}
        onClose={() => setZoomModal({ isOpen: false })}
      />
    </div>
  );
};
