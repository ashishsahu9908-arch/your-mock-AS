import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeDashboardView } from './components/HomeDashboardView';
import { DppUploadView } from './components/DppUploadView';
import { TestLibraryView } from './components/TestLibraryView';
import { QuestionVerificationView } from './components/QuestionVerificationView';
import { TestSetupView } from './components/TestSetupView';
import { JeeTestInterface } from './components/JeeTestInterface';
import { TestResultView } from './components/TestResultView';
import { TestHistoryView } from './components/TestHistoryView';
import { PracticeModeView } from './components/PracticeModeView';
import { Question, TestSetupConfig, TestResult, PreparedTest, ProcessingQueueItem } from './types';
import { StorageService, ActiveSessionData } from './utils/storage';
import { SAMPLE_DPPS, SampleDpp } from './data/sampleDpps';

type AppView = 'home' | 'upload' | 'library' | 'verify' | 'setup' | 'test' | 'practice' | 'result' | 'history';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => StorageService.getTheme() === 'dark');

  // Test setup & execution states
  const [extractedTitle, setExtractedTitle] = useState<string>('JEE Practice DPP');
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [activeTestConfig, setActiveTestConfig] = useState<TestSetupConfig | null>(null);
  const [activePracticeConfig, setActivePracticeConfig] = useState<TestSetupConfig | null>(null);
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [historyList, setHistoryList] = useState<TestResult[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);

  // Ready Tests (Test Library) and Background Processing Queue
  const [preparedTests, setPreparedTests] = useState<PreparedTest[]>([]);
  const [processingQueue, setProcessingQueue] = useState<ProcessingQueueItem[]>([]);

  // Initialize theme & load local storage on mount
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    StorageService.setTheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    setHistoryList(StorageService.getHistory());
    const existingActive = StorageService.getActiveSession();
    if (existingActive) {
      setActiveSession(existingActive);
    }

    // Load prepared tests from storage, seeding with sample DPPs ONLY on first visit
    const isInitialized = StorageService.isPreparedTestsInitialized();
    if (isInitialized) {
      setPreparedTests(StorageService.getPreparedTests());
    } else {
      const storedPrepared = StorageService.getPreparedTests();
      if (storedPrepared && storedPrepared.length > 0) {
        StorageService.markPreparedTestsInitialized();
        setPreparedTests(storedPrepared);
      } else {
        const initialPrepared: PreparedTest[] = SAMPLE_DPPS.map((sample, idx) => ({
          id: `prepared_sample_${sample.id}`,
          testTitle: sample.title,
          subject: sample.subject,
          createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
          status: 'ready',
          questions: JSON.parse(JSON.stringify(sample.questions)),
          answerKeyFound: true,
          sourceType: 'sample',
          totalQuestions: sample.questions.length,
        }));
        initialPrepared.forEach((t) => StorageService.savePreparedTest(t));
        StorageService.markPreparedTestsInitialized();
        setPreparedTests(initialPrepared);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const refreshHistory = () => {
    setHistoryList(StorageService.getHistory());
  };

  const refreshPreparedTests = () => {
    setPreparedTests(StorageService.getPreparedTests());
  };

  // 1. Questions extracted from PDF, Photos, or Sample
  const handleQuestionsExtracted = (
    data: {
      testTitle: string;
      questions: Question[];
      answerKeyFound?: boolean;
      subject?: string;
    },
    directToSetup?: boolean
  ) => {
    setExtractedTitle(data.testTitle);
    setExtractedQuestions(data.questions);
    refreshPreparedTests();

    if (directToSetup) {
      setCurrentView('setup');
    } else {
      setCurrentView('verify');
    }
  };

  // 2. Select curated sample from home or upload
  const handleSelectSampleDpp = (sample: SampleDpp) => {
    setExtractedTitle(sample.title);
    setExtractedQuestions(JSON.parse(JSON.stringify(sample.questions)));
    setCurrentView('verify');
  };

  // 3. Start test directly from Test Library (Zero waiting time!)
  const handleStartTestFromLibrary = (test: PreparedTest) => {
    setExtractedTitle(test.testTitle);
    setExtractedQuestions(JSON.parse(JSON.stringify(test.questions)));
    setCurrentView('setup');
  };

  // 3b. Start practice mode directly from Test Library
  const handleStartPracticeFromLibrary = (test: PreparedTest) => {
    const config: TestSetupConfig = {
      testId: `practice_${test.id}_${Date.now()}`,
      testName: `${test.testTitle} (Practice)`,
      durationMinutes: 60,
      durationHoursInput: 1,
      durationMinutesInput: 0,
      markingPattern: 'jee_main',
      markingScheme: {
        pattern: 'jee_main',
        jeeMain: { correct: 4, incorrect: -1, unattempted: 0 },
        jeeAdvanced: { fullMarks: 4, partialMarks: 2, incorrectMarks: -2, unattemptedMarks: 0 },
        custom: { correct: 4, partial: 2, incorrect: -1, unattempted: 0 },
      },
      questions: JSON.parse(JSON.stringify(test.questions)),
      totalQuestions: test.questions.length,
      createdAt: new Date().toISOString(),
    };
    setActivePracticeConfig(config);
    setCurrentView('practice');
  };

  // Start practice mode from test setup view
  const handleStartPracticeFromSetup = (config: TestSetupConfig) => {
    setActivePracticeConfig(config);
    setCurrentView('practice');
  };

  // 4. Verify test from Test Library
  const handleVerifyTestFromLibrary = (test: PreparedTest) => {
    setExtractedTitle(test.testTitle);
    setExtractedQuestions(JSON.parse(JSON.stringify(test.questions)));
    setCurrentView('verify');
  };

  // 5. Rename test in Test Library
  const handleRenameTestInLibrary = (id: string, newTitle: string) => {
    StorageService.updatePreparedTestTitle(id, newTitle);
    refreshPreparedTests();
  };

  // 6. Delete test in Test Library
  const handleDeleteTestInLibrary = (id: string) => {
    StorageService.deletePreparedTest(id);
    refreshPreparedTests();
    const currentActive = StorageService.getActiveSession();
    if (!currentActive && activeSession) {
      setActiveSession(null);
    }
  };

  // 7. Background batch processing for Test Library
  const processBatchItem = async (item: ProcessingQueueItem, file: File) => {
    setProcessingQueue((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? { ...q, status: 'processing', progressPercent: 15, stage: 'Reading document...' }
          : q
      )
    );

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const pdfBase64 = await base64Promise;

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
      let completeData: any = null;

      if (contentType.includes('text/event-stream') && response.body) {
        const streamReader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

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
                setProcessingQueue((prev) =>
                  prev.map((q) =>
                    q.id === item.id
                      ? {
                          ...q,
                          stage: payload.stage || q.stage,
                          progressPercent: payload.percent ?? q.progressPercent,
                          questionsIdentified: payload.questionsIdentified ?? q.questionsIdentified,
                          answersFound: payload.answersFound ?? q.answersFound,
                          imagesDetected: payload.imagesDetected ?? q.imagesDetected,
                          approxTimeRemaining: payload.approxTimeRemaining ?? q.approxTimeRemaining,
                        }
                      : q
                  )
                );
              } else if (payload.type === 'complete' && payload.data) {
                completeData = payload.data;
              } else if (payload.type === 'error') {
                throw new Error(payload.message);
              }
            } catch (pErr: any) {
              if (pErr.message && !pErr.message.includes('JSON')) throw pErr;
            }
          }
        }
      } else {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to extract questions');
        }
        completeData = data;
      }

      if (!completeData || !completeData.questions || completeData.questions.length === 0) {
        throw new Error('No questions could be detected in this document.');
      }

      // Save prepared test
      const prepared: PreparedTest = {
        id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        testTitle: completeData.testTitle || file.name.replace(/\.[^/.]+$/, ''),
        subject: completeData.subject || 'General',
        createdAt: new Date().toISOString(),
        status: 'ready',
        questions: completeData.questions,
        answerKeyFound: completeData.answerKeyFound,
        sourceType: 'pdf',
        fileName: file.name,
        totalQuestions: completeData.questions.length,
      };

      StorageService.savePreparedTest(prepared);
      refreshPreparedTests();

      setProcessingQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'ready',
                progressPercent: 100,
                stage: 'Preparation complete!',
                preparedTestId: prepared.id,
              }
            : q
        )
      );
    } catch (err: any) {
      console.error('Queue item failed:', err);
      setProcessingQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'failed',
                errorMessage: err.message || 'Processing failed. Please try again.',
              }
            : q
        )
      );
    }
  };

  const handleUploadBatchPdfs = (files: File[]) => {
    const newItems: { item: ProcessingQueueItem; file: File }[] = files.map((file, idx) => {
      const queueItem: ProcessingQueueItem = {
        id: `queue_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: 'pdf',
        addedAt: Date.now(),
        status: 'queued',
        stage: 'Queued for processing',
        progressPercent: 0,
        questionsIdentified: 0,
        answersFound: 0,
        imagesDetected: 0,
        approxTimeRemaining: 'Waiting in queue...',
      };
      return { item: queueItem, file };
    });

    setProcessingQueue((prev) => [...prev, ...newItems.map((n) => n.item)]);

    // Process items in sequence
    (async () => {
      for (const { item, file } of newItems) {
        await processBatchItem(item, file);
      }
    })();
  };

  const handleRemoveQueueItem = (id: string) => {
    setProcessingQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handleRetryQueueItem = (id: string) => {
    const item = processingQueue.find((q) => q.id === id);
    if (item) {
      setProcessingQueue((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, status: 'queued', errorMessage: undefined, progressPercent: 0 } : q
        )
      );
    }
  };

  // 8. User finishes verification and proceeds to setup
  const handleProceedToSetup = () => {
    if (extractedQuestions.length === 0) {
      alert('Please add at least one question before configuring the test.');
      return;
    }
    setCurrentView('setup');
  };

  // 9. Start Test from setup screen
  const handleStartTest = (config: TestSetupConfig) => {
    setActiveTestConfig(config);
    setCurrentView('test');
  };

  // 10. Test finished & submitted
  const handleFinishTest = (result: TestResult) => {
    setCurrentResult(result);
    setActiveTestConfig(null);
    setActiveSession(null);
    refreshHistory();
    setCurrentView('result');
  };

  // 11. Resume active session if exists
  const handleResumeActiveSession = () => {
    const session = StorageService.getActiveSession();
    if (session) {
      setActiveTestConfig(session.testConfig);
      setCurrentView('test');
    }
  };

  // 12. Retake a test
  const handleRetakeTest = () => {
    if (currentResult) {
      const matchingQuestions = currentResult.questionResults.map((qr) => ({
        id: qr.questionId,
        questionNumber: qr.questionNumber,
        subject: qr.subject,
        type: qr.type,
        questionText: qr.questionText,
        options: qr.options,
        correctAnswer: qr.correctAnswer,
        diagramSvg: qr.diagramSvg,
        imageUrl: qr.imageUrl,
        solution: qr.solution,
        hasSolution: qr.hasSolution,
        solutionSvg: qr.solutionSvg,
        solutionImageUrl: qr.solutionImageUrl,
      }));
      setExtractedTitle(currentResult.testName);
      setExtractedQuestions(matchingQuestions);
      setCurrentView('setup');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans antialiased flex flex-col">
      {/* Navbar is displayed on all views except during active test or practice to minimize distraction */}
      {currentView !== 'test' && currentView !== 'practice' && (
        <Navbar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          hasActiveTest={Boolean(activeSession)}
          readyTestsCount={preparedTests.length}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1">
        {/* VIEW 1: Home Dashboard */}
        {currentView === 'home' && (
          <HomeDashboardView
            onStartNewUpload={() => setCurrentView('upload')}
            onSelectSample={handleSelectSampleDpp}
            onViewHistory={() => setCurrentView('history')}
            onViewResult={(res) => {
              setCurrentResult(res);
              setCurrentView('result');
            }}
            recentResults={historyList}
            activeSession={activeSession}
            onResumeActiveSession={handleResumeActiveSession}
            onNavigateToLibrary={() => setCurrentView('library')}
            readyTestsCount={preparedTests.length}
          />
        )}

        {/* VIEW 2: Upload DPP (PDF or Question Photos) */}
        {currentView === 'upload' && (
          <DppUploadView 
            onQuestionsExtracted={handleQuestionsExtracted} 
            onNavigateToLibrary={() => setCurrentView('library')}
          />
        )}

        {/* VIEW 3: Test Library / Ready Tests */}
        {currentView === 'library' && (
          <TestLibraryView
            preparedTests={preparedTests}
            processingQueue={processingQueue}
            onStartTest={handleStartTestFromLibrary}
            onStartPractice={handleStartPracticeFromLibrary}
            onVerifyTest={handleVerifyTestFromLibrary}
            onRenameTest={handleRenameTestInLibrary}
            onDeleteTest={handleDeleteTestInLibrary}
            onUploadPdfs={handleUploadBatchPdfs}
            onRetryQueueItem={handleRetryQueueItem}
            onRemoveQueueItem={handleRemoveQueueItem}
            onNavigateToUpload={() => setCurrentView('upload')}
          />
        )}

        {/* VIEW 4: Question Verification & Answer Key Matrix */}
        {currentView === 'verify' && (
          <QuestionVerificationView
            testTitle={extractedTitle}
            onUpdateTitle={setExtractedTitle}
            questions={extractedQuestions}
            onUpdateQuestions={setExtractedQuestions}
            onProceed={handleProceedToSetup}
            onBack={() => setCurrentView('upload')}
          />
        )}

        {/* VIEW 5: Test Setup (Timer, Pattern: JEE Main / Adv / Custom) */}
        {currentView === 'setup' && (
          <TestSetupView
            initialTitle={extractedTitle}
            questions={extractedQuestions}
            onStartTest={handleStartTest}
            onStartPractice={handleStartPracticeFromSetup}
            onBackToVerification={() => setCurrentView('verify')}
          />
        )}

        {/* VIEW 6: JEE-Style Online CBT Examination Interface */}
        {currentView === 'test' && activeTestConfig && (
          <JeeTestInterface
            testConfig={activeTestConfig}
            onFinishTest={handleFinishTest}
            onExitTest={() => {
              if (window.confirm('Do you want to exit to the dashboard? Your ongoing test progress will be preserved.')) {
                setActiveSession(StorageService.getActiveSession());
                setCurrentView('home');
              }
            }}
          />
        )}

        {/* VIEW: Interactive Practice Mode */}
        {currentView === 'practice' && activePracticeConfig && (
          <PracticeModeView
            testConfig={activePracticeConfig}
            onExit={() => setCurrentView('library')}
            onSwitchToCbtExam={() => {
              setActiveTestConfig(activePracticeConfig);
              setCurrentView('test');
            }}
          />
        )}

        {/* VIEW 7: Results & Detailed Analysis */}
        {currentView === 'result' && currentResult && (
          <TestResultView
            result={currentResult}
            onRetake={handleRetakeTest}
            onHome={() => setCurrentView('home')}
            onViewHistory={() => setCurrentView('history')}
          />
        )}

        {/* VIEW 8: Test History */}
        {currentView === 'history' && (
          <TestHistoryView
            history={historyList}
            onSelectResult={(res) => {
              setCurrentResult(res);
              setCurrentView('result');
            }}
            onNewTest={() => setCurrentView('upload')}
            onRefreshHistory={refreshHistory}
            onBack={() => setCurrentView('home')}
          />
        )}
      </div>
    </div>
  );
}
