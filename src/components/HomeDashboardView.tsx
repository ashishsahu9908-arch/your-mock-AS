import React from 'react';
import { 
  FileUp, Play, History, Sparkles, Award, Clock, ArrowRight, 
  CheckCircle2, BookOpen, Layers, BarChart3, AlertCircle
} from 'lucide-react';
import { TestResult, TestSetupConfig } from '../types';
import { SAMPLE_DPPS, SampleDpp } from '../data/sampleDpps';
import { ActiveSessionData } from '../utils/storage';

interface HomeDashboardViewProps {
  onStartNewUpload: () => void;
  onSelectSample: (sample: SampleDpp) => void;
  onViewHistory: () => void;
  onViewResult: (result: TestResult) => void;
  recentResults: TestResult[];
  activeSession: ActiveSessionData | null;
  onResumeActiveSession: () => void;
  onNavigateToLibrary?: () => void;
  readyTestsCount?: number;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  onStartNewUpload,
  onSelectSample,
  onViewHistory,
  onViewResult,
  recentResults,
  activeSession,
  onResumeActiveSession,
  onNavigateToLibrary,
  readyTestsCount = 0,
}) => {
  // Aggregate statistics
  const totalTests = recentResults.length;
  const avgAccuracy = totalTests > 0
    ? (recentResults.reduce((acc, r) => acc + r.accuracy, 0) / totalTests).toFixed(1)
    : '0.0';
  const bestScorePercentage = totalTests > 0
    ? Math.max(...recentResults.map((r) => r.percentage)).toFixed(1)
    : '0.0';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Resume Active Test Banner if any */}
      {activeSession && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500 text-slate-900 dark:text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Active Examination In Progress
                </span>
              </div>
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                {activeSession.testConfig.testName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Remaining Time: {Math.floor(activeSession.remainingSeconds / 60)} minutes • {activeSession.testConfig.totalQuestions} Questions
              </p>
            </div>
          </div>

          <button
            onClick={onResumeActiveSession}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform hover:scale-105"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Test Now</span>
          </button>
        </div>
      )}

      {/* 2. Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-tr from-blue-700 via-indigo-700 to-slate-900 text-white p-6 sm:p-10 shadow-xl overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-xs border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>JEE Main & JEE Advanced CBT Simulation</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Turn Any DPP Sheet Into a Live JEE Test
          </h1>

          <p className="text-sm sm:text-base text-blue-100 font-medium">
            Upload your physics, chemistry, or mathematics practice problem PDF. Experience authentic computer-based testing with countdown timers, question palettes, and step/partial marking.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onStartNewUpload}
              className="px-6 py-3 rounded-2xl bg-white text-blue-700 font-black text-sm sm:text-base shadow-lg shadow-black/10 hover:bg-blue-50 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <FileUp className="w-4 h-4" />
              <span>Upload DPP PDF</span>
            </button>

            {onNavigateToLibrary && (
              <button
                onClick={onNavigateToLibrary}
                className="px-5 py-3 rounded-2xl bg-blue-600/70 hover:bg-blue-600/90 text-white font-bold text-sm backdrop-blur-xs border border-white/20 transition-all flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Ready Tests {readyTestsCount > 0 ? `(${readyTestsCount})` : ''}</span>
              </button>
            )}

            <button
              onClick={() => onSelectSample(SAMPLE_DPPS[0])}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm backdrop-blur-xs border border-white/20 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Try Instant Sample Mock</span>
            </button>
          </div>
        </div>

        {/* Decorative background visual */}
        <div className="absolute -bottom-10 -right-10 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* 3. Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Mock Tests Taken
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalTests}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Average Accuracy
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {avgAccuracy}%
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Personal Best Score
            </div>
            <div className="text-2xl font-black text-purple-600 font-mono">
              {bestScorePercentage}%
            </div>
          </div>
        </div>
      </div>

      {/* 4. Curated Mock DPP Sets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Pre-Loaded Authentic JEE Practice Sheets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jump straight into a timed test with LaTeX mathematical formulas, diagrams & answer keys.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_DPPS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                    {sample.targetExam}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {sample.totalQuestions} Qs • {sample.estimatedMinutes}m
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {sample.title}
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {sample.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">{sample.badge}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Launch Test <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Recent History Section (if any exists) */}
      {recentResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Recent Test Attempts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review your scores, accuracy, and question-by-question solutions.
              </p>
            </div>
            <button
              onClick={onViewHistory}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View All ({recentResults.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentResults.slice(0, 3).map((res) => (
              <div
                key={res.id}
                onClick={() => onViewResult(res)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 shadow-xs transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {res.markingScheme.pattern.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(res.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                    {res.testName}
                  </h4>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-600 font-mono">
                      {res.totalScore} / {res.maxMarks}
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold">
                      {res.accuracy.toFixed(1)}% Acc
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
