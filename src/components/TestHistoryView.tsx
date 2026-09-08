import React, { useState } from 'react';
import { History, Award, Clock, ArrowRight, Trash2, CheckCircle2, AlertCircle, FileText, ArrowLeft } from 'lucide-react';
import { TestResult } from '../types';
import { StorageService } from '../utils/storage';

interface TestHistoryViewProps {
  history: TestResult[];
  onSelectResult: (result: TestResult) => void;
  onNewTest: () => void;
  onRefreshHistory: () => void;
  onBack: () => void;
}

export const TestHistoryView: React.FC<TestHistoryViewProps> = ({
  history,
  onSelectResult,
  onNewTest,
  onRefreshHistory,
  onBack,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    StorageService.deleteResult(id);
    onRefreshHistory();
    setConfirmDeleteId(null);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all test records from local storage?')) {
      StorageService.clearHistory();
      onRefreshHistory();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Test History & Records
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            All tests and performance breakdowns are safely stored on your local device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900 transition-colors"
            >
              Clear All
            </button>
          )}

          <button
            onClick={onNewTest}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5"
          >
            <span>Create New Test</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            No Test Records Yet
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Upload your first DPP PDF or launch a sample mock test to begin building your examination performance history!
          </p>
          <button
            onClick={onNewTest}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <span>Start Practice Test</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record.id}
              onClick={() => onSelectResult(record)}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              {/* Left Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                    {record.markingScheme.pattern.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(record.completedAt).toLocaleDateString()} at{' '}
                    {new Date(record.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {record.isAutoSubmitted && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                      Auto-Submitted
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {record.testName}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    Questions: <strong>{record.questionResults.length}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Accuracy: <strong>{record.accuracy.toFixed(1)}%</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Time:{' '}
                    <strong>
                      {Math.floor(record.totalTimeUsedSeconds / 60)}m {record.totalTimeUsedSeconds % 60}s
                    </strong>
                  </span>
                </div>
              </div>

              {/* Right: Score badge & Action */}
              <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                <div className="text-left sm:text-right">
                  <div className="text-lg sm:text-2xl font-black text-emerald-600 font-mono">
                    {record.totalScore}
                    <span className="text-xs text-slate-400 font-normal"> / {record.maxMarks}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold">
                    {record.percentage.toFixed(1)}% Marks
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {confirmDeleteId === record.id ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 bg-red-50 dark:bg-red-950 p-1 rounded-lg border border-red-200 dark:border-red-900"
                    >
                      <button
                        onClick={(e) => handleDelete(record.id, e)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-1.5 py-1 text-slate-500 text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(record.id);
                      }}
                      title="Delete Record"
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
