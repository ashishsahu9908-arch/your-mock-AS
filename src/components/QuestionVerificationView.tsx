import React, { useState } from 'react';
import { Check, Edit3, AlertTriangle, ArrowRight, ArrowLeft, Plus, Trash2, Key, CheckCircle2, ZoomIn } from 'lucide-react';
import { Question, QuestionType, SubjectType } from '../types';
import { MathRenderer } from './MathRenderer';
import { ImageViewerModal } from './ImageViewerModal';

interface QuestionVerificationViewProps {
  testTitle: string;
  onUpdateTitle: (title: string) => void;
  questions: Question[];
  onUpdateQuestions: (questions: Question[]) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const QuestionVerificationView: React.FC<QuestionVerificationViewProps> = ({
  testTitle,
  onUpdateTitle,
  questions,
  onUpdateQuestions,
  onProceed,
  onBack,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAnswerKeyQuickMatrix, setShowAnswerKeyQuickMatrix] = useState(false);
  const [pastedKeyInput, setPastedKeyInput] = useState('');
  const [zoomModal, setZoomModal] = useState<{
    isOpen: boolean;
    imageUrl?: string;
    svgContent?: string;
    title?: string;
    caption?: string;
  }>({ isOpen: false });

  const uncertainCount = questions.filter(q => q.isUncertain).length;
  const answeredCount = questions.filter(q => {
    if (Array.isArray(q.correctAnswer)) return q.correctAnswer.length > 0;
    return Boolean(q.correctAnswer && q.correctAnswer.toString().trim());
  }).length;

  // Update a single question
  const updateQuestion = (index: number, updated: Partial<Question>) => {
    const copy = [...questions];
    copy[index] = { ...copy[index], ...updated };
    onUpdateQuestions(copy);
  };

  // Toggle or set correct answer for a question
  const handleToggleAnswer = (index: number, optionId: string) => {
    const q = questions[index];
    if (q.type === 'multi_choice') {
      const current = Array.isArray(q.correctAnswer)
        ? [...q.correctAnswer]
        : q.correctAnswer
        ? [q.correctAnswer]
        : [];
      const exists = current.includes(optionId);
      const next = exists ? current.filter(id => id !== optionId) : [...current, optionId].sort();
      updateQuestion(index, { correctAnswer: next });
    } else {
      updateQuestion(index, { correctAnswer: optionId });
    }
  };

  // Quick parser for bulk answer key paste like "1:A, 2:B, 3:C" or "1A 2B 3CD 4:12.5"
  const handleApplyBulkKey = () => {
    if (!pastedKeyInput.trim()) return;

    const copy = [...questions];
    // Regex matches patterns like "1. A", "1: A", "1- A", "1 A", "Q1: B, C"
    const regex = /(?:Q\s*)?(\d+)[\.\:\-\s]+([A-D,\s]+|\-?\d+(?:\.\d+)?)/gi;
    let match: RegExpExecArray | null;
    let appliedCount = 0;

    while ((match = regex.exec(pastedKeyInput)) !== null) {
      const qNum = parseInt(match[1], 10);
      const rawAns = match[2].trim().toUpperCase();
      const qIndex = copy.findIndex(q => q.questionNumber === qNum);

      if (qIndex !== -1) {
        if (copy[qIndex].type === 'multi_choice') {
          // Can be multiple letters like "A, C" or "AC"
          const letters = rawAns.match(/[A-D]/g);
          if (letters) {
            copy[qIndex].correctAnswer = Array.from(new Set(letters)).sort();
            appliedCount++;
          }
        } else if (copy[qIndex].type === 'numerical') {
          copy[qIndex].correctAnswer = rawAns.replace(/[^0-9\.\-]/g, '');
          appliedCount++;
        } else {
          // Single choice
          const letter = rawAns.match(/[A-D]/)?.[0];
          if (letter) {
            copy[qIndex].correctAnswer = letter;
            appliedCount++;
          }
        }
      }
    }

    if (appliedCount > 0) {
      onUpdateQuestions(copy);
      setPastedKeyInput('');
      setShowAnswerKeyQuickMatrix(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Upload
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={testTitle}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 px-2 py-1 rounded-lg border border-transparent focus:border-blue-500 outline-none transition-colors w-full max-w-xl"
              placeholder="Test Title"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review extracted questions and answer key before configuring the test.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => setShowAnswerKeyQuickMatrix(!showAnswerKeyQuickMatrix)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Key className="w-4 h-4 text-amber-500" />
            <span>Answer Key ({answeredCount}/{questions.length})</span>
          </button>

          <button
            onClick={onProceed}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 shadow-md shadow-blue-600/30 transition-all"
          >
            <span>Confirm & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Verification Mode Distinction Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex-shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm uppercase tracking-wide">
                Verification Mode • Pre-Test Review
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold">
                Answers Visible Here Only
              </span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
              Review and verify the extracted questions, options, and answer keys. Once you click "Confirm & Continue", you will enter Test Mode where all correct-answer indicators are completely hidden until submission.
            </p>
          </div>
        </div>

        <button
          onClick={onProceed}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 flex-shrink-0"
        >
          <span>Confirm & Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Uncertainty warning banner if any */}
      {uncertainCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              {uncertainCount} question{uncertainCount > 1 ? 's require' : ' requires'} verification:
            </span>{' '}
            Some equations or diagram notations had lower optical clarity in the source PDF. Please review the flagged questions below.
          </div>
        </div>
      )}

      {/* Quick Answer Key Matrix Drawer/Card */}
      {showAnswerKeyQuickMatrix && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Quick Answer Key Matrix
              </h3>
            </div>
            <button
              onClick={() => setShowAnswerKeyQuickMatrix(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click an option for each question to set its correct answer, or paste your answer key below:
          </p>

          {/* Grid of question answer selectors */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {questions.map((q, idx) => {
              const currentAns = Array.isArray(q.correctAnswer)
                ? q.correctAnswer
                : q.correctAnswer ? [q.correctAnswer] : [];

              return (
                <div
                  key={q.id}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span>Q{q.questionNumber}</span>
                    <span className="text-[10px] text-slate-400 uppercase">
                      {q.type === 'numerical' ? 'Num' : q.type === 'multi_choice' ? 'Multi' : 'MCQ'}
                    </span>
                  </div>

                  {q.type === 'numerical' ? (
                    <input
                      type="text"
                      value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                      onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                      placeholder="Ans value"
                      className="w-full text-xs p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                    />
                  ) : (
                    <div className="flex gap-1 justify-between">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const isSelected = currentAns.includes(opt);
                        return (
                          <button
                            key={opt}
                            onClick={() => handleToggleAnswer(idx, opt)}
                            className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bulk Paste Area */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={pastedKeyInput}
              onChange={(e) => setPastedKeyInput(e.target.value)}
              placeholder="Paste Answer Key (e.g. 1:A 2:C 3:B,D 4:12.5)"
              className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleApplyBulkKey}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity"
            >
              Apply Key
            </button>
          </div>
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const isEditing = editingIndex === idx;
          const currentAns = Array.isArray(q.correctAnswer)
            ? q.correctAnswer
            : q.correctAnswer ? [q.correctAnswer] : [];

          return (
            <div
              key={q.id}
              className={`rounded-2xl border transition-all ${
                q.isUncertain
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              } p-4 sm:p-6 shadow-xs`}
            >
              {/* Question metadata header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-extrabold text-sm flex items-center justify-center">
                    Q{q.questionNumber}
                  </span>

                  <select
                    value={q.subject}
                    onChange={(e) => updateQuestion(idx, { subject: e.target.value as SubjectType })}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="General">General</option>
                  </select>

                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(idx, { type: e.target.value as QuestionType })}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="single_choice">Single Correct MCQ</option>
                    <option value="multi_choice">One or More Correct (JEE Adv)</option>
                    <option value="numerical">Numerical Value</option>
                  </select>

                  {q.isUncertain && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                      <AlertTriangle className="w-3 h-3" /> Flagged for Verification
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {q.isUncertain && (
                    <button
                      onClick={() => updateQuestion(idx, { isUncertain: false, uncertaintyReason: '' })}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}

                  <button
                    onClick={() => setEditingIndex(isEditing ? null : idx)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Done Editing' : 'Edit Question'}</span>
                  </button>
                </div>
              </div>

              {/* Uncertainty reason banner if applicable */}
              {q.isUncertain && q.uncertaintyReason && (
                <div className="mb-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold">AI Detection Note:</span> {q.uncertaintyReason}
                </div>
              )}

              {/* Question text */}
              {isEditing ? (
                <div className="space-y-3 mb-4">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Question Text (Supports LaTeX in $...$ or $$...$$):
                  </label>
                  <textarea
                    rows={3}
                    value={q.questionText}
                    onChange={(e) => updateQuestion(idx, { questionText: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="mb-4 text-base sm:text-lg">
                  <MathRenderer content={q.questionText} />
                </div>
              )}

              {/* Extracted Diagram Image */}
              {q.imageUrl && (
                <div className="my-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-md mx-auto text-center space-y-2">
                  <div className="relative group inline-block overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
                    <img
                      src={q.imageUrl}
                      alt={`Question ${q.questionNumber} Diagram`}
                      className="max-h-60 w-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <button
                      onClick={() =>
                        setZoomModal({
                          isOpen: true,
                          imageUrl: q.imageUrl,
                          title: `Question ${q.questionNumber} Diagram`,
                          caption: q.diagramDescription,
                        })
                      }
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Zoom</span>
                    </button>
                  </div>
                  {q.diagramDescription && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      {q.diagramDescription}
                    </p>
                  )}
                </div>
              )}

              {/* Diagram / SVG rendering if present */}
              {q.diagramSvg && !q.imageUrl && (
                <div className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto text-center space-y-2">
                  <div 
                    className="cursor-zoom-in [&>svg]:max-w-full [&>svg]:h-auto mx-auto"
                    onClick={() =>
                      setZoomModal({
                        isOpen: true,
                        svgContent: q.diagramSvg,
                        title: `Question ${q.questionNumber} Diagram`,
                        caption: q.diagramDescription,
                      })
                    }
                    dangerouslySetInnerHTML={{ __html: q.diagramSvg }} 
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="italic">{q.diagramDescription || 'Schematic Diagram'}</span>
                    <button
                      onClick={() =>
                        setZoomModal({
                          isOpen: true,
                          svgContent: q.diagramSvg,
                          title: `Question ${q.questionNumber} Diagram`,
                          caption: q.diagramDescription,
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

              {q.diagramDescription && !q.diagramSvg && !q.imageUrl && (
                <div className="my-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
                  <span className="font-bold">Figure / Diagram Note:</span> {q.diagramDescription}
                </div>
              )}

              {/* Options */}
              {q.type !== 'numerical' ? (
                <div className="space-y-2 mt-4">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Options (Select correct answer below):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = currentAns.includes(opt.id);

                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleToggleAnswer(idx, opt.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs'
                              : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-400'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {isCorrect ? <Check className="w-3.5 h-3.5" /> : opt.id}
                          </div>

                          <div className="flex-1 text-sm pt-0.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={opt.text}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const opts = [...q.options];
                                  opts[optIdx] = { ...opts[optIdx], text: e.target.value };
                                  updateQuestion(idx, { options: opts });
                                }}
                                className="w-full p-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <MathRenderer content={opt.text} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Numerical value correct answer input */
                <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Correct Numerical Answer:
                  </div>
                  <input
                    type="text"
                    value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                    onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                    placeholder="Enter correct numerical value (e.g. 12 or 3.5)"
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono w-full sm:w-64 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Extracted Solution if present */}
              {q.solution && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/60 text-xs">
                  <div className="font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Extracted Solution:
                  </div>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={q.solution}
                      onChange={(e) => updateQuestion(idx, { solution: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  ) : (
                    <MathRenderer content={q.solution} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom CTA bar */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Back to Upload
        </button>

        <button
          onClick={onProceed}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-600/30 transition-all"
        >
          <span>Confirm & Continue to Test Setup ({questions.length} Questions)</span>
          <ArrowRight className="w-4 h-4" />
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
