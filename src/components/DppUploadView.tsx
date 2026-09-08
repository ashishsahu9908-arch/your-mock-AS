import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, Sparkles, AlertCircle, ArrowRight, CheckCircle2, 
  RefreshCw, FileUp, Zap, HelpCircle, Image as ImageIcon, Trash2, 
  ChevronUp, ChevronDown, Plus, Layers, BookOpen, MoveLeft, MoveRight
} from 'lucide-react';
import { Question } from '../types';
import { SAMPLE_DPPS, SampleDpp } from '../data/sampleDpps';
import { StorageService } from '../utils/storage';

interface UploadedPhoto {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

interface DppUploadViewProps {
  onQuestionsExtracted: (
    data: {
      testTitle: string;
      questions: Question[];
      answerKeyFound?: boolean;
      subject?: string;
    },
    directToSetup?: boolean
  ) => void;
  onNavigateToLibrary?: () => void;
}

/**
 * Strips raw JSON, status codes, and formats errors into user-friendly guidance
 */
function formatUserFriendlyError(raw: any): string {
  if (!raw) {
    return 'An unexpected issue occurred while analyzing the document. Please try again.';
  }
  let str = '';
  if (typeof raw === 'string') {
    str = raw;
  } else if (raw.message && typeof raw.message === 'string') {
    str = raw.message;
  } else if (raw.error) {
    str = typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error);
  } else {
    try {
      str = JSON.stringify(raw);
    } catch {
      str = String(raw);
    }
  }

  // If serialized JSON
  if (str.includes('{') && str.includes('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.error?.message) str = parsed.error.message;
      else if (parsed.message) str = parsed.message;
      else if (parsed.error) str = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
    } catch {
      // ignore
    }
  }

  if (/503|unavailable|high demand|spikes in demand|overloaded|busy/i.test(str)) {
    return 'The AI service is temporarily experiencing high demand. Please retry in a few moments, or select one of our pre-loaded practice sheets.';
  }
  if (/429|quota|rate limit|resource.*exhausted/i.test(str)) {
    return 'The AI service is momentarily rate-limited. Please wait a few seconds and try again, or try our pre-loaded JEE DPPs.';
  }
  if (/api.?key/i.test(str)) {
    return 'The Gemini API key is not configured on the server. Please check the AI Studio Secrets panel.';
  }
  if (/too large|payload/i.test(str)) {
    return 'The uploaded document is too large. Please upload a smaller DPP file.';
  }

  // Remove technical prefixes and raw JSON
  let cleaned = str
    .replace(/^Error:\s*/i, '')
    .replace(/status:\s*[A-Z_0-9]+/i, '')
    .replace(/^\{.*"error"\s*:\s*"?([^"\}]+)"?.*\}$/s, '$1')
    .replace(/^\d{3}\s*/, '')
    .trim();

  return cleaned || 'Unable to extract questions from this file. Please verify the document format or try again.';
}

export const DppUploadView: React.FC<DppUploadViewProps> = ({ onQuestionsExtracted, onNavigateToLibrary }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'paste'>('upload');
  const [uploadMode, setUploadMode] = useState<'pdf' | 'photos'>('pdf');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('Processing your DPP...');
  const [progressPercent, setProgressPercent] = useState(15);
  const [questionsProcessed, setQuestionsProcessed] = useState(0);
  const [questionsIdentified, setQuestionsIdentified] = useState(0);
  const [answersFound, setAnswersFound] = useState(0);
  const [imagesDetected, setImagesDetected] = useState(0);
  const [approxTimeRemaining, setApproxTimeRemaining] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    testTitle: string;
    questions: Question[];
    answerKeyFound?: boolean;
    subject?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  // Common stream & JSON handler
  const handleStreamOrJsonResponse = async (
    response: Response,
    fallbackTitle: string,
    sourceType: 'pdf' | 'photos' | 'text'
  ) => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') && response.body) {
      const streamReader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completeData: any = null;

      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const payload = JSON.parse(jsonStr);
            if (payload.type === 'progress') {
              if (payload.stage) setProcessingStep(payload.stage);
              if (typeof payload.percent === 'number') setProgressPercent(payload.percent);
              if (typeof payload.questionsProcessed === 'number') {
                setQuestionsProcessed(payload.questionsProcessed);
              }
              if (typeof payload.questionsIdentified === 'number') {
                setQuestionsIdentified(payload.questionsIdentified);
              }
              if (typeof payload.answersFound === 'number') {
                setAnswersFound(payload.answersFound);
              }
              if (typeof payload.imagesDetected === 'number') {
                setImagesDetected(payload.imagesDetected);
              }
              if (payload.approxTimeRemaining) {
                setApproxTimeRemaining(payload.approxTimeRemaining);
              }
            } else if (payload.type === 'status' && payload.message) {
              setProcessingStep(payload.message);
            } else if (payload.type === 'complete' && payload.data) {
              completeData = payload.data;
              setProgressPercent(100);
            } else if (payload.type === 'error') {
              throw new Error(payload.message);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      if (completeData && completeData.questions && completeData.questions.length > 0) {
        setProcessingStep('Questions successfully extracted!');
        setIsProcessing(false);
        const title = completeData.testTitle || fallbackTitle;
        const questions = completeData.questions;
        const answerKeyFound = completeData.answerKeyFound;
        const subject = completeData.subject;

        // Auto-save to Test Library so user can instantly practice anytime
        StorageService.savePreparedTest({
          id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          testTitle: title,
          subject: subject || 'General',
          createdAt: new Date().toISOString(),
          status: 'ready',
          questions,
          answerKeyFound,
          sourceType,
          totalQuestions: questions.length,
        });

        setCompletedResult({
          testTitle: title,
          questions,
          answerKeyFound,
          subject,
        });
        return;
      } else if (completeData && (!completeData.questions || completeData.questions.length === 0)) {
        throw new Error('No questions could be detected. Please verify the document/photo quality.');
      }
    }

    // Standard JSON fallback
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to extract questions.');
    }

    if (!data.questions || data.questions.length === 0) {
      throw new Error('No questions could be detected in this upload. Please verify the image/document format.');
    }

    setProcessingStep('Questions successfully extracted!');
    setIsProcessing(false);
    const title = data.testTitle || fallbackTitle;
    const questions = data.questions;
    const answerKeyFound = data.answerKeyFound;
    const subject = data.subject;

    StorageService.savePreparedTest({
      id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      testTitle: title,
      subject: subject || 'General',
      createdAt: new Date().toISOString(),
      status: 'ready',
      questions,
      answerKeyFound,
      sourceType,
      totalQuestions: questions.length,
    });

    setCompletedResult({
      testTitle: title,
      questions,
      answerKeyFound,
      subject,
    });
  };

  // Handle Photo files selection (multiple JPG, JPEG, PNG, WEBP)
  const handlePhotoFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validPhotos = fileArray.filter((file) => {
      const type = file.type.toLowerCase();
      const name = file.name.toLowerCase();
      return (
        type.startsWith('image/') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp')
      );
    });

    if (validPhotos.length === 0) {
      setErrorMessage('Please select valid image files (.jpg, .jpeg, .png, .webp).');
      return;
    }

    setErrorMessage(null);

    // Read all photos into base64 + previewUrl
    const loadedPhotos: UploadedPhoto[] = await Promise.all(
      validPhotos.map(async (file, idx) => {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        return {
          id: `photo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          file,
          name: file.name,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType: file.type || 'image/jpeg',
        };
      })
    );

    setUploadedPhotos((prev) => [...prev, ...loadedPhotos]);
  };

  const handleRemovePhoto = (id: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleMovePhoto = (index: number, direction: 'up' | 'down') => {
    setUploadedPhotos((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleProcessPhotos = async () => {
    if (uploadedPhotos.length === 0) {
      setErrorMessage('Please select at least one question photo to process.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProgressPercent(15);
    setQuestionsProcessed(0);
    setQuestionsIdentified(0);
    setAnswersFound(0);
    setImagesDetected(uploadedPhotos.length);
    setApproxTimeRemaining('Estimating remaining time...');
    setProcessingStep(`Reading ${uploadedPhotos.length} photo(s) with AI...`);

    try {
      const payloadImages = uploadedPhotos.map((p) => ({
        base64: p.base64,
        mimeType: p.mimeType,
        name: p.name,
      }));

      const defaultTitle = `Practice Sheet (${uploadedPhotos.length} Photos)`;

      const response = await fetch('/api/extract-dpp?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify({
          images: payloadImages,
          fileName: defaultTitle,
        }),
      });

      await handleStreamOrJsonResponse(response, defaultTitle, 'photos');
    } catch (err: any) {
      console.error('Photo processing error:', err);
      setIsProcessing(false);
      setErrorMessage(formatUserFriendlyError(err));
    }
  };

  // Handle PDF file selection
  const handleFile = async (file: File) => {
    if (!file) return;

    // Check file type
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isText = file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');

    if (!isPdf && !isText) {
      setErrorMessage('Please upload a valid PDF document or text file.');
      return;
    }

    setLastUploadedFile(file);
    setErrorMessage(null);
    setIsProcessing(true);
    setProgressPercent(15);
    setQuestionsProcessed(0);
    setApproxTimeRemaining('Estimating remaining time...');
    setProcessingStep('Reading document binary...');

    try {
      if (isPdf) {
        setProcessingStep('Converting PDF for AI multimodal analysis...');
        const reader = new FileReader();

        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const pdfBase64 = await base64Promise;

        setProcessingStep('Processing your DPP...');

        const response = await fetch('/api/extract-dpp?stream=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream, application/json',
          },
          body: JSON.stringify({
            pdfBase64,
            fileName: file.name.replace(/\.[^/.]+$/, ''),
          }),
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream') && response.body) {
          const streamReader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let completeData: any = null;

          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              if (!jsonStr) continue;

              try {
                const payload = JSON.parse(jsonStr);
                if (payload.type === 'progress') {
                  if (payload.stage) setProcessingStep(payload.stage);
                  if (typeof payload.percent === 'number') setProgressPercent(payload.percent);
                  if (typeof payload.questionsProcessed === 'number') {
                    setQuestionsProcessed(payload.questionsProcessed);
                  }
                  if (payload.approxTimeRemaining) {
                    setApproxTimeRemaining(payload.approxTimeRemaining);
                  }
                } else if (payload.type === 'status' && payload.message) {
                  setProcessingStep(payload.message);
                } else if (payload.type === 'complete' && payload.data) {
                  completeData = payload.data;
                  setProgressPercent(100);
                } else if (payload.type === 'error') {
                  throw new Error(payload.message);
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes('JSON')) {
                  throw parseErr;
                }
              }
            }
          }

          if (completeData && completeData.questions && completeData.questions.length > 0) {
            setProcessingStep('Questions successfully extracted!');
            setIsProcessing(false);
            setCompletedResult({
              testTitle: completeData.testTitle || file.name.replace(/\.[^/.]+$/, ''),
              questions: completeData.questions,
              answerKeyFound: completeData.answerKeyFound,
              subject: completeData.subject,
            });
            return;
          } else if (completeData && (!completeData.questions || completeData.questions.length === 0)) {
            throw new Error('No questions could be detected in this document. Please verify the PDF format.');
          }
        } else {
          // Standard JSON response fallback
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to extract questions from the uploaded PDF.');
          }

          if (!data.questions || data.questions.length === 0) {
            throw new Error('No questions could be detected in this document. Please verify the PDF format.');
          }

          setProcessingStep('Questions successfully extracted!');
          setIsProcessing(false);
          setCompletedResult({
            testTitle: data.testTitle || file.name.replace(/\.[^/.]+$/, ''),
            questions: data.questions,
            answerKeyFound: data.answerKeyFound,
            subject: data.subject,
          });
        }
      } else {
        // Text file
        const text = await file.text();
        await processTextContent(text, file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err: any) {
      console.error('DPP upload processing error:', err);
      setErrorMessage(formatUserFriendlyError(err));
      setIsProcessing(false);
    }
  };

  const processTextContent = async (text: string, title?: string) => {
    setIsProcessing(true);
    setProgressPercent(20);
    setQuestionsProcessed(0);
    setApproxTimeRemaining('Parsing text questions...');
    setProcessingStep('Processing your DPP...');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/extract-dpp?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify({
          textContent: text,
          fileName: title || 'Pasted DPP Questions',
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && response.body) {
        const streamReader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let completeData: any = null;

        while (true) {
          const { done, value } = await streamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            if (!jsonStr) continue;

            try {
              const payload = JSON.parse(jsonStr);
              if (payload.type === 'progress') {
                if (payload.stage) setProcessingStep(payload.stage);
                if (typeof payload.percent === 'number') setProgressPercent(payload.percent);
                if (typeof payload.questionsProcessed === 'number') {
                  setQuestionsProcessed(payload.questionsProcessed);
                }
                if (payload.approxTimeRemaining) {
                  setApproxTimeRemaining(payload.approxTimeRemaining);
                }
              } else if (payload.type === 'status' && payload.message) {
                setProcessingStep(payload.message);
              } else if (payload.type === 'complete' && payload.data) {
                completeData = payload.data;
                setProgressPercent(100);
              } else if (payload.type === 'error') {
                throw new Error(payload.message);
              }
            } catch (parseErr: any) {
              if (parseErr.message && !parseErr.message.includes('JSON')) {
                throw parseErr;
              }
            }
          }
        }

        if (completeData && completeData.questions && completeData.questions.length > 0) {
          setProcessingStep('Questions successfully extracted!');
          setIsProcessing(false);
          setCompletedResult({
            testTitle: completeData.testTitle || title || 'Extracted DPP Test',
            questions: completeData.questions,
            answerKeyFound: completeData.answerKeyFound,
            subject: completeData.subject,
          });
          return;
        }
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse text content.');
      }

      setIsProcessing(false);
      setCompletedResult({
        testTitle: data.testTitle || title || 'Extracted DPP Test',
        questions: data.questions,
        answerKeyFound: data.answerKeyFound,
        subject: data.subject,
      });
    } catch (err: any) {
      setErrorMessage(formatUserFriendlyError(err));
      setIsProcessing(false);
    }
  };

  const handleSelectSample = (sample: SampleDpp) => {
    setCompletedResult({
      testTitle: sample.title,
      questions: JSON.parse(JSON.stringify(sample.questions)),
      answerKeyFound: true,
      subject: sample.subject,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3 border border-blue-200 dark:border-blue-900">
          <Sparkles className="w-3.5 h-3.5" />
          <span>JEE Main & Advanced CBT Engine</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Convert Your DPP into a Live JEE Test
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Upload any Daily Practice Problem PDF. Our AI extracts questions, LaTeX equations, options, diagrams, and section headers into a full computer-based examination.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'upload'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FileUp className="w-4 h-4" />
          <span>Upload DPP PDF</span>
        </button>

        <button
          onClick={() => setActiveTab('samples')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'samples'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Pre-loaded JEE DPPs</span>
        </button>

        <button
          onClick={() => setActiveTab('paste')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'paste'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paste Questions</span>
        </button>
      </div>

      {/* Error alert with retry and fallback */}
      {errorMessage && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100 transition-all">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-bold text-amber-950 dark:text-amber-100">DPP Processing Notice</p>
              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">{errorMessage}</p>

              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                {lastUploadedFile && (
                  <button
                    onClick={() => handleFile(lastUploadedFile)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>Retry Processing</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setActiveTab('samples');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-all"
                >
                  <span>Try Pre-loaded JEE DPPs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Upload (PDF or Question Photos) */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Two Clear Options Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isProcessing) setUploadMode('pdf');
              }}
              className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 transition-all ${
                uploadMode === 'pdf'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  uploadMode === 'pdf'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-sm sm:text-base">1. Upload DPP PDF</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Single or multi-page practice problem PDF document
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isProcessing) setUploadMode('photos');
              }}
              className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 transition-all ${
                uploadMode === 'photos'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  uploadMode === 'photos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-sm sm:text-base">2. Upload Question Photos</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select multiple JPG, PNG, WEBP images from mobile/desktop
                </div>
              </div>
            </button>
          </div>

          {/* OPTION 1: UPLOAD DPP PDF */}
          {uploadMode === 'pdf' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-900/40'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />

                {isProcessing ? (
                  <div className="py-8 flex flex-col items-center">
                    <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Processing DPP with AI...
                    </h3>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 font-medium text-center max-w-md">
                      {processingStep}
                    </p>
                    <div className="mt-4 w-72 max-w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(10, Math.min(100, progressPercent))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between w-72 max-w-full text-xs text-slate-500 dark:text-slate-400">
                      <span>{questionsProcessed > 0 ? `${questionsProcessed} question(s) parsed` : 'Analyzing document'}</span>
                      <span>{approxTimeRemaining || `${progressPercent}%`}</span>
                    </div>

                    {(questionsIdentified > 0 || answersFound > 0) && (
                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Questions: <strong>{questionsIdentified}</strong></span>
                        <span>•</span>
                        <span>Answers: <strong>{answersFound}</strong></span>
                        <span>•</span>
                        <span>Images: <strong>{imagesDetected}</strong></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Drop your DPP PDF here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Supports Physics, Chemistry, and Mathematics sheets with mathematical equations, diagrams, and answer keys.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auto LaTeX Equation Extraction
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Preserves Section Headers
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Flags Uncertain Items
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPTION 2: UPLOAD QUESTION PHOTOS */}
          {uploadMode === 'photos' && (
            <div className="space-y-4">
              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handlePhotoFilesSelected(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              {/* Processing Progress View */}
              {isProcessing ? (
                <div className="p-8 sm:p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center flex flex-col items-center">
                  <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Analyzing Question Photos with AI...
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 font-medium text-center max-w-md">
                    {processingStep}
                  </p>
                  <div className="mt-4 w-72 max-w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(10, Math.min(100, progressPercent))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between w-72 max-w-full text-xs text-slate-500 dark:text-slate-400">
                    <span>{questionsProcessed > 0 ? `${questionsProcessed} question(s) parsed` : `${uploadedPhotos.length} photos in sequence`}</span>
                    <span>{approxTimeRemaining || `${progressPercent}%`}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Questions identified: <strong>{questionsIdentified}</strong></span>
                    <span>•</span>
                    <span>Answers found: <strong>{answersFound}</strong></span>
                    <span>•</span>
                    <span>Images detected: <strong>{imagesDetected}</strong></span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Photo Dropzone if empty or add more */}
                  {uploadedPhotos.length === 0 ? (
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
                          handlePhotoFilesSelected(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => photoFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-900/40'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Upload Multiple Question Photos
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Select multiple JPG, JPEG, PNG, or WEBP photos of your DPP. You can review, reorder, and remove photos before processing.
                      </p>

                      <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs sm:text-sm shadow-sm">
                        <Plus className="w-4 h-4" />
                        <span>Select Photos from Device</span>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Multi-photo selection
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Multi-page question stitching
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Reorder before AI read
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Photo management toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {uploadedPhotos.length} {uploadedPhotos.length === 1 ? 'Photo' : 'Photos'} Selected
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            (Photos will be read sequentially 1 to {uploadedPhotos.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => photoFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add More Photos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadedPhotos([])}
                            className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* Photo Thumbnails Grid with Reordering */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {uploadedPhotos.map((photo, index) => (
                          <div
                            key={photo.id}
                            className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex flex-col justify-between shadow-xs group"
                          >
                            {/* Sequence Badge */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-600 text-white">
                                #{index + 1}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(photo.size / 1024).toFixed(0)} KB
                              </span>
                            </div>

                            {/* Image Thumbnail */}
                            <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative mb-2">
                              <img
                                src={photo.previewUrl}
                                alt={`Question photo ${index + 1}`}
                                className="w-full h-full object-contain"
                              />
                            </div>

                            {/* Filename */}
                            <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate mb-2">
                              {photo.name}
                            </div>

                            {/* Reorder and Delete Controls */}
                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Move Left / Earlier"
                                  disabled={index === 0}
                                  onClick={() => handleMovePhoto(index, 'up')}
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <MoveLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Move Right / Later"
                                  disabled={index === uploadedPhotos.length - 1}
                                  onClick={() => handleMovePhoto(index, 'down')}
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <MoveRight className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                type="button"
                                title="Remove photo"
                                onClick={() => handleRemovePhoto(photo.id)}
                                className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Instructions on multi-photo question stitching */}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        💡 <strong>Tip:</strong> If a single question continues across two photos, ensure they are placed consecutively in the order above. The AI reads all photos together and stitches questions naturally.
                      </p>

                      {/* Process Photos Action Button */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleProcessPhotos}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Extract Questions from {uploadedPhotos.length} Photo{uploadedPhotos.length > 1 ? 's' : ''}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Quick info card */}
          <div className="mt-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-4 h-4 flex-shrink-0 text-blue-500 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Ready Tests Library Integration
                </p>
                <p className="mt-0.5">
                  Extracted DPPs are automatically saved in your <strong>Test Library</strong>. Once processed, you never have to re-read the document or wait for AI analysis again.
                </p>
              </div>
            </div>

            {onNavigateToLibrary && (
              <button
                type="button"
                onClick={onNavigateToLibrary}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold border border-slate-200 dark:border-slate-600 flex-shrink-0 text-xs hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1"
              >
                <span>View Library</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Curated Pre-loaded JEE DPPs */}
      {activeTab === 'samples' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select one of these curated authentic JEE practice problem sets to immediately test the simulator:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_DPPS.map((sample) => (
              <div
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                className="group relative p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                      {sample.targetExam}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {sample.totalQuestions} Qs • {sample.estimatedMinutes}m
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {sample.title}
                  </h3>

                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                    {sample.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {sample.badge}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                    Select <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Paste Questions Text */}
      {activeTab === 'paste' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Paste DPP Questions or OCR Text
            </label>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste questions here with options...&#10;&#10;Example:&#10;Q1. Two charges +q and -q are placed at distance d...&#10;(A) kq/d&#10;(B) 2kq/d&#10;(C) 0&#10;(D) kq/2d"
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>

          <button
            onClick={() => {
              if (pastedText.trim()) {
                processTextContent(pastedText.trim(), 'Pasted Practice Sheet');
              } else {
                setErrorMessage('Please enter question text before parsing.');
              }
            }}
            disabled={isProcessing || !pastedText.trim()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Parsing with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Extract Questions with AI</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Post-Processing Workflow Modal: Check Questions & Answers vs Confirm & Continue */}
      {completedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              DPP Successfully Processed!
            </h3>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 font-medium line-clamp-1">
              {completedResult.testTitle}
            </p>

            {/* Badges / Metrics */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {completedResult.questions.length} Questions Extracted
              </span>
              <span className="px-3 py-1 rounded-full font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                {completedResult.subject || 'All Subjects'}
              </span>
              <span className="px-3 py-1 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                {completedResult.answerKeyFound ? 'Answer Key Detected' : 'Answer Key Ready'}
              </span>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              How would you like to proceed with your extracted questions?
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Check Questions & Answers (Admin/Verification Mode) */}
              <button
                type="button"
                onClick={() => {
                  const data = completedResult;
                  setCompletedResult(null);
                  onQuestionsExtracted(data, false);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm"
              >
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span>Check Questions & Answers</span>
              </button>

              {/* Option 2: Confirm & Continue (Direct to Test Configuration) */}
              <button
                type="button"
                onClick={() => {
                  const data = completedResult;
                  setCompletedResult(null);
                  onQuestionsExtracted(data, true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 transition-all"
              >
                <span>Confirm & Continue</span>
                <ArrowRight className="w-4 h-4 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
