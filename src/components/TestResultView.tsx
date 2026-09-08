import React, { useState, useEffect } from 'react';
import { 
  Trophy, CheckCircle, XCircle, MinusCircle, Clock, Award, ArrowLeft, 
  RotateCcw, Share2, Filter, AlertCircle, HelpCircle, Check, BookOpen,
  ChevronDown, ChevronUp, Printer, Timer, Zap, Hourglass, ZoomIn,
  Search, ExternalLink, Globe
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TestResult, QuestionOutcome } from '../types';
import { MathRenderer } from './MathRenderer';
import { ImageViewerModal } from './ImageViewerModal';

/**
 * Creates an intelligent, web-friendly search URL for the question on Google.
 * Strips raw LaTeX delimiters to produce clean keyword search strings.
 */
function buildGoogleSearchUrl(
  questionText: string,
  subject?: string,
  options?: Array<{ id: string; text: string }>
): string {
  // Strip LaTeX markers like $ and \frac, \text etc. to create a clean query for Google
  let cleanText = questionText
    .replace(/\$\$?/g, ' ')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}\\_^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If text is long, take up to 200 characters to keep search query focused
  if (cleanText.length > 200) {
    cleanText = cleanText.substring(0, 200).trim();
  }

  const queryParts = [cleanText];
  if (subject && subject !== 'General') {
    queryParts.push(subject);
  }
  queryParts.push('JEE');

  const fullQuery = queryParts.join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}`;
}

interface TestResultViewProps {
  result: TestResult;
  onRetake: () => void;
  onHome: () => void;
  onViewHistory: () => void;
}

export const TestResultView: React.FC<TestResultViewProps> = ({
  result,
  onRetake,
  onHome,
  onViewHistory,
}) => {
  const [filter, setFilter] = useState<'all' | QuestionOutcome>('all');
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});
  const [zoomModal, setZoomModal] = useState<{
    isOpen: boolean;
    imageUrl?: string;
    svgContent?: string;
    title?: string;
    caption?: string;
  }>({ isOpen: false });

  useEffect(() => {
    // Fire celebratory confetti if score is >= 50%
    if (result.percentage >= 50) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore if canvas-confetti fails
      }
    }
  }, [result.percentage]);

  const toggleSolution = (qId: string) => {
    setExpandedSolutions((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Filter questions
  const filteredQuestions = result.questionResults.filter((qr) => {
    if (filter === 'all') return true;
    return qr.outcome === filter;
  });

  // Time format helper
  const formatTimeMinutesSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            onClick={onHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Test Performance & Analysis
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {result.testName} • Completed on {new Date(result.completedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          <button
            onClick={onRetake}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm font-bold shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Test</span>
          </button>
        </div>
      </div>

      {/* Auto-submission alert banner if applicable */}
      {result.isAutoSubmitted && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Automated Time-Expiry Submission:</span> This test was submitted automatically when the countdown timer reached 00:00. Unanswered questions were registered as unattempted according to examination regulations.
          </div>
        </div>
      )}

      {/* 2. Hero Score Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {/* Total Score */}
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs col-span-2 sm:col-span-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Score Obtained
            </div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
              {result.totalScore}
              <span className="text-lg text-slate-400 font-normal"> / {result.maxMarks}</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300">
              {result.percentage.toFixed(1)}% Marks
            </div>
          </div>

          {/* Accuracy */}
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Accuracy
            </div>
            <div className="text-3xl sm:text-4xl font-black text-blue-400 font-mono">
              {result.accuracy.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300">
              {result.totalCorrect} correct of {result.totalAttempted} attempted
            </div>
          </div>

          {/* Time Taken */}
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Time Taken
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
              {formatTimeMinutesSeconds(result.totalTimeUsedSeconds)}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300">
              Allocated: {result.totalDurationMinutes}m
            </div>
          </div>

          {/* Avg Time / Question */}
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Speed
            </div>
            <div className="text-3xl sm:text-4xl font-black text-purple-400 font-mono">
              {result.averageTimePerQuestionSeconds}s
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300">
              Average per question
            </div>
          </div>
        </div>

        {/* Outcome counters bar */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="flex items-center justify-center gap-2 font-semibold">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <span>Fully Correct: <strong className="text-white">{result.totalCorrect}</strong></span>
          </div>

          {result.totalPartiallyCorrect > 0 && (
            <div className="flex items-center justify-center gap-2 font-semibold">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              <span>Partially Correct: <strong className="text-white">{result.totalPartiallyCorrect}</strong></span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 font-semibold">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span>Incorrect: <strong className="text-white">{result.totalIncorrect}</strong></span>
          </div>

          <div className="flex items-center justify-center gap-2 font-semibold">
            <span className="w-3 h-3 rounded-full bg-slate-400" />
            <span>Unattempted: <strong className="text-white">{result.totalUnattempted}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Marking Scheme Used Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Applied Marking Rules
            </h3>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            {result.markingScheme.pattern.replace('_', ' ')}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 dark:text-slate-300">
          <div>
            Correct Answer: <strong className="text-emerald-600 font-bold">+{result.markingScheme.jeeMain.correct}</strong>
          </div>
          <div>
            Incorrect Answer: <strong className="text-red-600 font-bold">{result.markingScheme.jeeMain.incorrect}</strong>
          </div>
          <div>
            Partial / Step Marks:{' '}
            <strong className="text-blue-600 font-bold">
              +{result.markingScheme.jeeAdvanced.partialMarks}
            </strong>
          </div>
          <div>
            Unattempted: <strong className="text-slate-500 font-bold">{result.markingScheme.jeeMain.unattempted}</strong>
          </div>
        </div>
      </div>

      {/* 4. Time Management & Question Speed Analysis Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Time Management & Speed Analysis
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Total Time Spent: {formatTimeMinutesSeconds(result.totalTimeUsedSeconds)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Average per Question */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Avg. per Question
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {result.averageTimePerQuestionSeconds}s
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across all {result.questionResults.length} questions
            </div>
          </div>

          {/* Average per Attempted Question */}
          <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20">
            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">
              Avg. on Attempted
            </div>
            <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {result.averageTimePerAttemptedQuestionSeconds || result.averageTimePerQuestionSeconds}s
            </div>
            <div className="text-[11px] text-blue-700/80 dark:text-blue-300 mt-0.5">
              Across {result.totalAttempted} attempted questions
            </div>
          </div>

          {/* Fastest Question Answered */}
          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <span>Fastest Question</span>
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {result.fastestQuestion ? `${result.fastestQuestion.timeSpentSeconds}s` : 'N/A'}
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300 font-semibold mt-0.5">
              {result.fastestQuestion ? `Question ${result.fastestQuestion.questionNumber}` : 'No questions attempted'}
            </div>
          </div>

          {/* Slowest Question Answered */}
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
              <span>Most Time Spent</span>
              <Hourglass className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {result.slowestQuestion ? `${result.slowestQuestion.timeSpentSeconds}s` : 'N/A'}
            </div>
            <div className="text-[11px] text-amber-700/80 dark:text-amber-300 font-semibold mt-0.5">
              {result.slowestQuestion ? `Question ${result.slowestQuestion.questionNumber}` : 'No questions attempted'}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Subject-wise Analysis */}
      {result.subjectAnalysis && result.subjectAnalysis.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            Subject-wise Performance Breakdown
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.subjectAnalysis.map((sub) => (
              <div
                key={sub.subject}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {sub.subject}
                    </span>
                    <span className="text-xs font-black text-emerald-600 font-mono">
                      {sub.scoreObtained} / {sub.maxMarks}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Questions:</span>
                      <span className="font-semibold">{sub.totalQuestions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Attempted:</span>
                      <span className="font-semibold">{sub.attempted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Correct:</span>
                      <span className="font-semibold text-emerald-600">{sub.correct}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Incorrect:</span>
                      <span className="font-semibold text-red-500">{sub.incorrect}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Accuracy:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {sub.accuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Detailed Question-by-Question Analysis */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
              Question-by-Question Detailed Review
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review your answer, correct key, marks awarded, time spent, and detailed step-by-step solutions.
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all', label: `All (${result.questionResults.length})` },
              { key: 'fully_correct', label: `Correct (${result.totalCorrect})` },
              ...(result.totalPartiallyCorrect > 0
                ? [{ key: 'partially_correct', label: `Partial (${result.totalPartiallyCorrect})` }]
                : []),
              { key: 'incorrect', label: `Incorrect (${result.totalIncorrect})` },
              { key: 'unattempted', label: `Unattempted (${result.totalUnattempted})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  filter === tab.key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          {filteredQuestions.map((qr) => {
            const hasValidSolution = Boolean(qr.hasSolution || (qr.solution && String(qr.solution).trim().length > 0));
            // Solution must be HIDDEN by default as explicitly requested
            const isSolutionOpen = Boolean(expandedSolutions[qr.questionId]);

            // Outcome badge styling
            let badgeBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
            let outcomeText = 'Unattempted';
            if (qr.outcome === 'fully_correct') {
              badgeBg = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
              outcomeText = 'Correct';
            } else if (qr.outcome === 'partially_correct') {
              badgeBg = 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';
              outcomeText = 'Partially Correct';
            } else if (qr.outcome === 'incorrect') {
              badgeBg = 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800';
              outcomeText = 'Incorrect';
            }

            const formattedUserAns = Array.isArray(qr.userAnswer)
              ? qr.userAnswer.join(', ')
              : qr.userAnswer || 'None';
            const formattedCorrectAns = Array.isArray(qr.correctAnswer)
              ? qr.correctAnswer.join(', ')
              : qr.correctAnswer || 'Not Specified';

            const googleSearchUrl = buildGoogleSearchUrl(qr.questionText, qr.subject, qr.options);

            return (
              <div
                key={qr.questionId}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4"
              >
                {/* Question header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold text-sm flex items-center justify-center">
                      Q{qr.questionNumber}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {qr.subject}
                    </span>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-md border ${badgeBg}`}
                    >
                      {outcomeText}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono font-bold">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {qr.timeSpentSeconds}s
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-md ${
                        qr.marksAwarded > 0
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                          : qr.marksAwarded < 0
                          ? 'bg-red-50 dark:bg-red-950 text-red-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {qr.marksAwarded > 0 ? `+${qr.marksAwarded}` : qr.marksAwarded} Marks
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-base">
                  <MathRenderer content={qr.questionText} />
                </div>

                {/* Extracted Image / Diagram */}
                {qr.imageUrl && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-md mx-auto text-center space-y-2">
                    <div className="relative group inline-block overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
                      <img
                        src={qr.imageUrl}
                        alt={`Question ${qr.questionNumber} Diagram`}
                        className="max-h-60 w-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      <button
                        onClick={() =>
                          setZoomModal({
                            isOpen: true,
                            imageUrl: qr.imageUrl,
                            title: `Question ${qr.questionNumber} Diagram`,
                            caption: qr.diagramDescription,
                          })
                        }
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Zoom</span>
                      </button>
                    </div>
                    {qr.diagramDescription && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        {qr.diagramDescription}
                      </p>
                    )}
                  </div>
                )}

                {/* Inline SVG Diagram */}
                {qr.diagramSvg && !qr.imageUrl && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto text-center space-y-2">
                    <div 
                      className="cursor-zoom-in [&>svg]:max-w-full [&>svg]:h-auto mx-auto"
                      onClick={() =>
                        setZoomModal({
                          isOpen: true,
                          svgContent: qr.diagramSvg,
                          title: `Question ${qr.questionNumber} Diagram`,
                          caption: qr.diagramDescription,
                        })
                      }
                      dangerouslySetInnerHTML={{ __html: qr.diagramSvg }} 
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="italic">{qr.diagramDescription || 'Schematic Diagram'}</span>
                      <button
                        onClick={() =>
                          setZoomModal({
                            isOpen: true,
                            svgContent: qr.diagramSvg,
                            title: `Question ${qr.questionNumber} Diagram`,
                            caption: qr.diagramDescription,
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

                {/* Options Review */}
                {qr.options && qr.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {qr.options.map((opt) => {
                      const isCorrect = Array.isArray(qr.correctAnswer)
                        ? qr.correctAnswer.includes(opt.id)
                        : qr.correctAnswer === opt.id;
                      const isUserChoice = Array.isArray(qr.userAnswer)
                        ? qr.userAnswer.includes(opt.id)
                        : qr.userAnswer === opt.id;

                      let optBorder = 'border-slate-200 dark:border-slate-800';
                      let optBg = 'bg-slate-50/50 dark:bg-slate-800/30';
                      if (isCorrect) {
                        optBorder = 'border-emerald-500 dark:border-emerald-700';
                        optBg = 'bg-emerald-50/60 dark:bg-emerald-950/40';
                      } else if (isUserChoice && !isCorrect) {
                        optBorder = 'border-red-500 dark:border-red-700';
                        optBg = 'bg-red-50/60 dark:bg-red-950/40';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border ${optBorder} ${optBg} flex items-start gap-2.5 text-xs sm:text-sm`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : isUserChoice
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <div className="flex-1 pt-0.5">
                            <MathRenderer content={opt.text} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* User Response vs Key & Metrics Summary */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Your Answer: </span>
                      <span
                        className={`font-mono font-bold ${
                          qr.outcome === 'fully_correct'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : qr.outcome === 'partially_correct'
                            ? 'text-blue-600 dark:text-blue-400'
                            : qr.outcome === 'incorrect'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {formattedUserAns}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Correct Answer: </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formattedCorrectAns}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTimeMinutesSeconds(qr.timeSpentSeconds)}
                    </span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                        qr.marksAwarded > 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : qr.marksAwarded < 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {qr.marksAwarded > 0 ? `+${qr.marksAwarded}` : qr.marksAwarded} Marks
                    </span>
                  </div>
                </div>

                {/* Solution / Help Section (Available for EVERY Question) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {hasValidSolution ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleSolution(qr.questionId)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors shadow-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{isSolutionOpen ? 'Hide Solution' : 'Show Solution'}</span>
                          {isSolutionOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isSolutionOpen && (
                          <a
                            href={googleSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-semibold transition-colors"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Search Discussions on Google</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {isSolutionOpen && (
                        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/80 text-xs sm:text-sm text-slate-800 dark:text-slate-200 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-900/60">
                            <span className="font-extrabold text-xs uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                              Solution (Extracted from DPP)
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Preserved verbatim
                            </span>
                          </div>

                          {/* Solution Diagram / Image if present */}
                          {qr.solutionImageUrl && (
                            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 max-w-sm mx-auto text-center">
                              <img
                                src={qr.solutionImageUrl}
                                alt={`Question ${qr.questionNumber} Solution Diagram`}
                                className="max-h-56 w-auto object-contain rounded-lg mx-auto"
                              />
                            </div>
                          )}

                          {/* Solution SVG Diagram if present */}
                          {qr.solutionSvg && (
                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 max-w-sm mx-auto text-center">
                              <div
                                className="cursor-zoom-in [&>svg]:max-w-full [&>svg]:h-auto mx-auto"
                                onClick={() =>
                                  setZoomModal({
                                    isOpen: true,
                                    svgContent: qr.solutionSvg,
                                    title: `Question ${qr.questionNumber} Solution Diagram`,
                                  })
                                }
                                dangerouslySetInnerHTML={{ __html: qr.solutionSvg }}
                              />
                            </div>
                          )}

                          {/* Solution Text with MathRenderer */}
                          <div className="leading-relaxed">
                            <MathRenderer content={qr.solution || ''} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* No solution in DPP: Show informative note + prominent Google Search button */
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                          No solution was provided in the uploaded DPP.
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Click below to search for step-by-step solutions, video explanations, and discussions on Google.
                        </p>
                      </div>

                      <a
                        href={googleSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all flex-shrink-0"
                      >
                        <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Search Solution on Google</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Nav Actions */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={onViewHistory}
          className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          View All Past Test History
        </button>

        <button
          onClick={onHome}
          className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Return to Dashboard
        </button>
      </div>

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
