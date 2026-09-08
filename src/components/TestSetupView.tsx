import React, { useState, useEffect } from 'react';
import { Clock, Award, Play, ArrowLeft, Check, Sparkles, Sliders, ShieldCheck, BookOpen } from 'lucide-react';
import { MarkingPatternType, MarkingScheme, Question, TestSetupConfig } from '../types';
import { DEFAULT_MARKING_SCHEME } from '../utils/marking';
import { FullscreenButton } from './FullscreenButton';

interface TestSetupViewProps {
  initialTitle: string;
  questions: Question[];
  onStartTest: (config: TestSetupConfig) => void;
  onStartPractice?: (config: TestSetupConfig) => void;
  onBackToVerification: () => void;
}

export const TestSetupView: React.FC<TestSetupViewProps> = ({
  initialTitle,
  questions,
  onStartTest,
  onStartPractice,
  onBackToVerification,
}) => {
  const [testName, setTestName] = useState(initialTitle || 'JEE Daily Practice Mock Test');
  const [selectedPattern, setSelectedPattern] = useState<MarkingPatternType>('jee_main');
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(questions.length <= 10 ? 30 : 60);

  // Custom marking values
  const [customScheme, setCustomScheme] = useState({
    correct: 4,
    partial: 2,
    incorrect: -1,
    unattempted: 0,
  });

  // JEE Advanced specific marking configuration
  const [jeeAdvScheme, setJeeAdvScheme] = useState({
    fullMarks: 4,
    partialMarks: 2,
    incorrectMarks: -2,
    unattemptedMarks: 0,
  });

  // Number of questions to include (defaults to all questions from the DPP)
  const [questionCount, setQuestionCount] = useState<number>(questions.length);

  // Keep questionCount synchronized whenever questions change
  useEffect(() => {
    setQuestionCount(questions.length);
  }, [questions.length]);

  // Quick duration selection
  const setQuickDuration = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    setHours(h);
    setMinutes(m);
  };

  const totalDurationMinutes = hours * 60 + minutes;

  const handleStart = () => {
    if (totalDurationMinutes <= 0) {
      alert('Please configure a valid test duration of at least 1 minute.');
      return;
    }

    const markingScheme: MarkingScheme = {
      ...DEFAULT_MARKING_SCHEME,
      pattern: selectedPattern,
      jeeAdvanced: jeeAdvScheme,
      custom: customScheme,
    };

    const selectedQuestions = questionCount >= questions.length ? questions : questions.slice(0, questionCount);

    const config: TestSetupConfig = {
      testId: `test_${Date.now()}`,
      testName: testName.trim() || 'JEE Online Mock Test',
      durationMinutes: totalDurationMinutes,
      durationHoursInput: hours,
      durationMinutesInput: minutes,
      markingPattern: selectedPattern,
      markingScheme,
      questions: selectedQuestions,
      totalQuestions: selectedQuestions.length,
      createdAt: new Date().toISOString(),
    };

    onStartTest(config);
  };

  const handleStartPractice = () => {
    if (questionCount <= 0) {
      alert('Please select at least 1 question.');
      return;
    }

    const selectedQuestions = questionCount >= questions.length ? questions : questions.slice(0, questionCount);

    const currentMarkingScheme: MarkingScheme = {
      ...DEFAULT_MARKING_SCHEME,
      pattern: selectedPattern,
      jeeAdvanced: jeeAdvScheme,
      custom: customScheme,
    };

    const config: TestSetupConfig = {
      testId: `practice_${Date.now()}`,
      testName: `${testName.trim() || 'JEE Practice'} (Practice Mode)`,
      durationMinutes: totalDurationMinutes,
      durationHoursInput: hours,
      durationMinutesInput: minutes,
      markingPattern: selectedPattern,
      markingScheme: currentMarkingScheme,
      questions: selectedQuestions,
      totalQuestions: selectedQuestions.length,
      createdAt: new Date().toISOString(),
    };

    if (onStartPractice) {
      onStartPractice(config);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToVerification}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Review Questions
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Test Setup & Configuration
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure exam timer, marking scheme, and pattern before launching the CBT simulator.
          </p>
        </div>

        <div className="flex-shrink-0 self-start sm:self-center">
          <FullscreenButton
            showLabel={true}
            id="setup-top-fullscreen-btn"
            className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-750"
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. Test Name & Question Count */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
              1
            </span>
            <span>Test Name & Scope</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Test Name
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. JEE Main Electrostatics DPP #01"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Number of Questions
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: questions.length }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} Question{n > 1 ? 's' : ''} {n === questions.length ? '(All)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Customizable Timer */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
                2
              </span>
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Customizable Test Timer</span>
            </h2>

            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-mono">
              Total: {totalDurationMinutes} minutes ({hours}h {minutes}m)
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set custom hours and minutes or select a quick preset. The countdown timer starts only when you click "Start Test".
          </p>

          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-2">
            {[30, 60, 90, 180].map((preset) => {
              const isSelected = totalDurationMinutes === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuickDuration(preset)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {preset} minutes {preset >= 60 ? `(${preset / 60}h)` : ''}
                </button>
              );
            })}
          </div>

          {/* Hours and Minutes custom spinners */}
          <div className="grid grid-cols-2 gap-4 max-w-sm pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Hours
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Minutes
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="1"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value || '0', 10))))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Marking Pattern Selection (Exactly 3 options) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
              3
            </span>
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Marking Pattern Selection</span>
          </h2>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose your examination marking rules. The selected scheme is stored with the test and used for exact result evaluation.
          </p>

          {/* Three selectable cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pattern 1: JEE Main Pattern (Default) */}
            <div
              onClick={() => setSelectedPattern('jee_main')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                selectedPattern === 'jee_main'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Standard Format
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedPattern === 'jee_main'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedPattern === 'jee_main' && <Check className="w-3 h-3" />}
                  </div>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  JEE Main Pattern
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Default format for single-correct MCQs.
                </p>
              </div>

              {/* Preview */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-mono">
                <div className="text-slate-700 dark:text-slate-300 font-semibold space-y-1">
                  <div>Correct: <span className="text-emerald-600 font-bold">+4</span></div>
                  <div>Incorrect: <span className="text-red-600 font-bold">-1</span></div>
                  <div>Unattempted: <span className="text-slate-500">0</span></div>
                </div>
              </div>
            </div>

            {/* Pattern 2: JEE Advanced Pattern (Step/Partial Marking) */}
            <div
              onClick={() => setSelectedPattern('jee_advanced')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                selectedPattern === 'jee_advanced'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Step / Partial Marks
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedPattern === 'jee_advanced'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedPattern === 'jee_advanced' && <Check className="w-3 h-3" />}
                  </div>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  JEE Advanced Pattern
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports full, partial step, negative & zero marks.
                </p>
              </div>

              {/* Preview */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-mono">
                <div className="text-slate-700 dark:text-slate-300 font-semibold space-y-1">
                  <div>Full: <span className="text-emerald-600 font-bold">+{jeeAdvScheme.fullMarks}</span></div>
                  <div>Partial: <span className="text-blue-600 font-bold">+{jeeAdvScheme.partialMarks} (step)</span></div>
                  <div>Incorrect: <span className="text-red-600 font-bold">{jeeAdvScheme.incorrectMarks}</span></div>
                  <div>Unattempted: <span className="text-slate-500">0</span></div>
                </div>
              </div>
            </div>

            {/* Pattern 3: Custom Pattern */}
            <div
              onClick={() => setSelectedPattern('custom')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                selectedPattern === 'custom'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Customizable Rules
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedPattern === 'custom'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedPattern === 'custom' && <Check className="w-3 h-3" />}
                  </div>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Custom Pattern
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Completely customize marks for every outcome.
                </p>
              </div>

              {/* Preview */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-mono">
                <div className="text-slate-700 dark:text-slate-300 font-semibold space-y-1">
                  <div>Correct: <span className="text-emerald-600 font-bold">+{customScheme.correct}</span></div>
                  <div>Partial: <span className="text-blue-600 font-bold">+{customScheme.partial}</span></div>
                  <div>Incorrect: <span className="text-red-600 font-bold">{customScheme.incorrect}</span></div>
                  <div>Unattempted: <span className="text-slate-500">{customScheme.unattempted}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected pattern preview banner as specified in prompt */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-mono">
            <div className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Active Marking Rules Preview:
            </div>
            {selectedPattern === 'jee_main' && (
              <div className="text-slate-900 dark:text-slate-100 font-bold">
                JEE Main Pattern: Correct: <span className="text-emerald-600">+4</span> | Incorrect: <span className="text-red-600">-1</span> | Unattempted: <span className="text-slate-500">0</span>
              </div>
            )}
            {selectedPattern === 'jee_advanced' && (
              <div className="text-slate-900 dark:text-slate-100 font-bold">
                JEE Advanced Pattern: Full: <span className="text-emerald-600">Full Marks (+{jeeAdvScheme.fullMarks})</span> | Partial: <span className="text-blue-600">Step/Partial (+{jeeAdvScheme.partialMarks})</span> | Incorrect: <span className="text-red-600">Negative ({jeeAdvScheme.incorrectMarks})</span> | Unattempted: <span className="text-slate-500">0</span>
              </div>
            )}
            {selectedPattern === 'custom' && (
              <div className="text-slate-900 dark:text-slate-100 font-bold">
                Custom Pattern: Fully Correct: [ {customScheme.correct} ] | Partially Correct: [ {customScheme.partial} ] | Incorrect: [ {customScheme.incorrect} ] | Unattempted: [ {customScheme.unattempted} ]
              </div>
            )}
          </div>

          {/* Customizable Inputs for Custom Pattern */}
          {selectedPattern === 'custom' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Configure Custom Marking Values:
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Fully Correct
                  </label>
                  <input
                    type="number"
                    value={customScheme.correct}
                    onChange={(e) =>
                      setCustomScheme({ ...customScheme, correct: parseFloat(e.target.value || '0') })
                    }
                    className="w-full p-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Partially Correct
                  </label>
                  <input
                    type="number"
                    value={customScheme.partial}
                    onChange={(e) =>
                      setCustomScheme({ ...customScheme, partial: parseFloat(e.target.value || '0') })
                    }
                    className="w-full p-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Incorrect
                  </label>
                  <input
                    type="number"
                    value={customScheme.incorrect}
                    onChange={(e) =>
                      setCustomScheme({ ...customScheme, incorrect: parseFloat(e.target.value || '0') })
                    }
                    className="w-full p-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Unattempted
                  </label>
                  <input
                    type="number"
                    value={customScheme.unattempted}
                    onChange={(e) =>
                      setCustomScheme({ ...customScheme, unattempted: parseFloat(e.target.value || '0') })
                    }
                    className="w-full p-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Start Test Trigger Bar */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-200" />
              <h3 className="font-extrabold text-lg text-white">
                Ready to Begin Examination?
              </h3>
            </div>
            <p className="text-xs text-blue-100 mt-1 max-w-lg">
              Timer: <span className="font-bold text-white">{totalDurationMinutes} minutes</span> • Questions:{' '}
              <span className="font-bold text-white">{questionCount}</span> • Pattern:{' '}
              <span className="font-bold text-white uppercase">{selectedPattern.replace('_', ' ')}</span>
            </p>
            <p className="text-[11px] text-blue-200 mt-1">
              * The countdown timer will start only when you click "Start Test".
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-shrink-0">
            <FullscreenButton
              showLabel={true}
              id="setup-bar-fullscreen-btn"
              className="px-4 py-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-sm sm:text-base flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            />

            {onStartPractice && (
              <button
                type="button"
                onClick={handleStartPractice}
                className="px-5 py-3.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 border border-white/20 transition-all hover:scale-105 active:scale-95"
                title="Practice mode with immediate feedback and step-by-step solutions"
              >
                <BookOpen className="w-5 h-5" />
                <span>Practice Mode</span>
              </button>
            )}

            <button
              onClick={handleStart}
              className="px-8 py-3.5 rounded-xl bg-white text-blue-600 hover:bg-blue-50 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-black/10 transition-transform hover:scale-105 active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start CBT Exam</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
