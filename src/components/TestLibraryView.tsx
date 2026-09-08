import React, { useState } from 'react';
import { 
  FolderCheck, Upload, Play, CheckCircle2, Clock, Trash2, Edit2, 
  RefreshCw, AlertCircle, Sparkles, FileText, ArrowRight, X, ChevronRight,
  Layers, Plus, Check, Search, BookOpen
} from 'lucide-react';
import { PreparedTest, ProcessingQueueItem, Question } from '../types';

interface TestLibraryViewProps {
  preparedTests: PreparedTest[];
  processingQueue: ProcessingQueueItem[];
  onStartTest: (test: PreparedTest) => void;
  onStartPractice?: (test: PreparedTest) => void;
  onVerifyTest: (test: PreparedTest) => void;
  onRenameTest: (id: string, newTitle: string) => void;
  onDeleteTest: (id: string) => void;
  onUploadPdfs: (files: File[]) => void;
  onRetryQueueItem: (id: string) => void;
  onRemoveQueueItem: (id: string) => void;
  onNavigateToUpload: () => void;
}

export const TestLibraryView: React.FC<TestLibraryViewProps> = ({
  preparedTests,
  processingQueue,
  onStartTest,
  onStartPractice,
  onVerifyTest,
  onRenameTest,
  onDeleteTest,
  onUploadPdfs,
  onRetryQueueItem,
  onRemoveQueueItem,
  onNavigateToUpload,
}) => {
  const [activeTab, setActiveTab] = useState<'ready' | 'prepare'>('ready');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Delete Confirmation and Notification state
  const [testToDelete, setTestToDelete] = useState<PreparedTest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteToastMessage, setDeleteToastMessage] = useState<string | null>(null);

  // Auto-dismiss delete toast message
  React.useEffect(() => {
    if (deleteToastMessage) {
      const timer = setTimeout(() => {
        setDeleteToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [deleteToastMessage]);

  // Handle ESC key to dismiss modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && testToDelete && !isDeleting) {
        setTestToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testToDelete, isDeleting]);

  const handleConfirmDelete = () => {
    if (!testToDelete || isDeleting) return;
    setIsDeleting(true);
    const idToDelete = testToDelete.id;
    try {
      onDeleteTest(idToDelete);
      setDeleteToastMessage('Test deleted successfully.');
    } catch (err) {
      console.error('Failed to delete test:', err);
    } finally {
      setIsDeleting(false);
      setTestToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setTestToDelete(null);
  };

  // Filter ready tests by title or subject
  const filteredTests = preparedTests.filter((test) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      test.testTitle.toLowerCase().includes(q) ||
      test.subject.toLowerCase().includes(q) ||
      (test.fileName && test.fileName.toLowerCase().includes(q))
    );
  });

  const activeProcessingCount = processingQueue.filter(
    (q) => q.status === 'processing' || q.status === 'queued'
  ).length;

  const handleStartRename = (test: PreparedTest) => {
    setEditingId(test.id);
    setEditingTitle(test.testTitle);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameTest(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUploadPdfs(files);
      setActiveTab('prepare');
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-2 border border-blue-200 dark:border-blue-900">
            <FolderCheck className="w-3.5 h-3.5" />
            <span>YOUR MOCK AS • Test Library</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Test Library & Ready Tests
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Process multiple DPP PDFs in advance. Tests saved here load immediately with zero waiting time when you are ready to practice.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all shadow-blue-600/20"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Multiple DPPs</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      {/* Tabs: Ready Tests vs Upload & Prepare */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('ready')}
          className={`flex items-center gap-2 pb-3 px-5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'ready'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Ready Tests</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
            {preparedTests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('prepare')}
          className={`flex items-center gap-2 pb-3 px-5 text-sm font-bold border-b-2 transition-colors relative ${
            activeTab === 'prepare'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Upload & Prepare Test</span>
          {activeProcessingCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white font-bold animate-pulse">
              {activeProcessingCount} processing
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: READY TESTS */}
      {activeTab === 'ready' && (
        <div className="space-y-6">
          {/* Search bar & info */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ready tests by title or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Ready to start immediately without AI waiting time
            </div>
          </div>

          {/* Active processing banner if any */}
          {activeProcessingCount > 0 && (
            <div 
              onClick={() => setActiveTab('prepare')}
              className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-100/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span>
                  Preparing {activeProcessingCount} DPP{activeProcessingCount > 1 ? 's' : ''} in the background... Click to view live progress.
                </span>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                View Queue <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          )}

          {/* List of Ready Tests */}
          {filteredTests.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {preparedTests.length === 0
                  ? 'No Prepared Tests in Your Library Yet'
                  : 'No Tests Match Your Search'}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {preparedTests.length === 0
                  ? 'Upload DPP PDFs in advance or process question photos. Once analyzed, your tests are stored here and can be launched instantly.'
                  : 'Try searching with a different keyword or clear the search input.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload DPP PDFs Now</span>
                </button>
                <button
                  onClick={onNavigateToUpload}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm"
                >
                  <span>Upload Question Photos</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTests.map((test) => (
                <div
                  key={test.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group hover:border-blue-400 dark:hover:border-blue-500"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                        {test.subject || 'General'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Ready
                      </span>
                    </div>

                    {/* Test Title / Inline Rename */}
                    {editingId === test.id ? (
                      <div className="mb-3 space-y-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-blue-500 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(test.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveRename(test.id)}
                            className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-2 leading-snug">
                          {test.testTitle}
                        </h3>
                        <button
                          onClick={() => handleStartRename(test)}
                          title="Rename test"
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-4">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {test.totalQuestions || test.questions.length} Questions
                      </span>
                      <span>•</span>
                      <span>
                        Added {new Date(test.createdAt).toLocaleDateString()}
                      </span>
                      {test.answerKeyFound && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Answer Key Present
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onVerifyTest(test)}
                        title="Check Questions & Answers"
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        id={`delete-test-btn-${test.id}`}
                        onClick={() => {
                          setTestToDelete(test);
                        }}
                        title="Delete test"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onStartPractice && (
                        <button
                          onClick={() => onStartPractice(test)}
                          className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold text-xs flex items-center gap-1 transition-all"
                          title="Practice mode with instant answer checking and solutions"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Practice</span>
                        </button>
                      )}

                      <button
                        onClick={() => onStartTest(test)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Exam</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD & PREPARE TEST (BATCH QUEUE) */}
      {activeTab === 'prepare' && (
        <div className="space-y-6">
          {/* Drag & Drop Multi-PDF Upload Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = (Array.from(e.dataTransfer.files) as File[]).filter((f) =>
                  f.name.toLowerCase().endsWith('.pdf')
                );
                if (files.length > 0) {
                  onUploadPdfs(files);
                }
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-900/40'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Drop Multiple DPP PDFs here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Select 1, 5, or 10 DPP PDFs at once. Each document is analyzed in the background and converted into permanent ready-to-launch tests.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>Supports Physics, Chemistry & Mathematics</span>
              <span>•</span>
              <span>Automatic LaTeX formula extraction</span>
            </div>
          </div>

          {/* Processing Queue List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Preparation Queue & Status
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {processingQueue.length} {processingQueue.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Queue continues running even if you navigate to other pages
              </p>
            </div>

            {processingQueue.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
                No active processing tasks. Upload one or more PDFs above to begin preparation.
              </div>
            ) : (
              <div className="space-y-3">
                {processingQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                            {item.fileName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.fileSize ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB • ` : ''}
                            Added {new Date(item.addedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {item.status === 'queued' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            Queued
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Processing
                          </span>
                        )}
                        {item.status === 'ready' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ready
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}

                        <button
                          onClick={() => onRemoveQueueItem(item.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                          title="Remove item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar and Live Indicators for 'processing' */}
                    {item.status === 'processing' && (
                      <div className="space-y-2 pt-1">
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${Math.max(10, Math.min(100, item.progressPercent))}%` }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.stage || 'Analyzing document...'}
                          </span>
                          <span>{item.approxTimeRemaining || `${item.progressPercent}%`}</span>
                        </div>

                        {/* Live Counts: Questions identified, Answers identified, Images detected */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium">
                            Questions identified:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {item.questionsIdentified}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="font-medium">
                            Answers identified:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {item.answersFound}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="font-medium">
                            Images detected:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {item.imagesDetected}
                            </strong>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Failed state message & Retry */}
                    {item.status === 'failed' && (
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <p className="text-red-600 dark:text-red-400">
                          {item.errorMessage || 'Processing failed. Please try again.'}
                        </p>
                        <button
                          onClick={() => onRetryQueueItem(item.id)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 self-start sm:self-auto"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Processing</span>
                        </button>
                      </div>
                    )}

                    {/* Ready state: view or launch */}
                    {item.status === 'ready' && (
                      <div className="pt-1 flex items-center justify-between text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Questions and answer key successfully extracted and saved!
                        </span>
                        <button
                          onClick={() => {
                            setActiveTab('ready');
                          }}
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>Go to Ready Tests</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {testToDelete && (
        <div
          id="delete-confirmation-dialog-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) handleCancelDelete();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div
            id="delete-confirmation-dialog"
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="delete-dialog-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  Delete this test?
                </h2>
                <p
                  id="delete-dialog-desc"
                  className="mt-1 text-sm text-slate-600 dark:text-slate-400"
                >
                  This test and its saved question data will be permanently removed.
                </p>
              </div>
            </div>

            {/* Test info preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-left">
              <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                {testToDelete.testTitle}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{testToDelete.subject || 'General'}</span>
                <span>•</span>
                <span>{testToDelete.totalQuestions || testToDelete.questions?.length || 0} questions</span>
              </div>
            </div>

            {/* Dialog Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-delete-test-btn"
                disabled={isDeleting}
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-test-btn"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {deleteToastMessage && (
        <div
          id="delete-success-toast"
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl border border-slate-800 dark:border-slate-200 text-sm font-semibold transition-all animate-in fade-in slide-in-from-bottom-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span>{deleteToastMessage}</span>
          <button
            type="button"
            onClick={() => setDeleteToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white dark:hover:text-slate-700 p-0.5 rounded transition-colors"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
