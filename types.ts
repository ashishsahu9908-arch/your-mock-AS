export type SubjectType = 'Physics' | 'Chemistry' | 'Mathematics' | 'General';

export type QuestionType = 'single_choice' | 'multi_choice' | 'numerical';

export type MarkingPatternType = 'jee_main' | 'jee_advanced' | 'custom';

export type QuestionOutcome = 'fully_correct' | 'partially_correct' | 'incorrect' | 'unattempted';

export interface Option {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  questionNumber: number;
  subject: SubjectType;
  sectionName?: string;
  type: QuestionType;
  questionText: string;
  diagramDescription?: string;
  diagramSvg?: string;
  imageUrl?: string;
  options: Option[];
  correctAnswer: string | string[]; // 'A', or ['A', 'C'] for multi_choice, or '42' / '42.5' for numerical
  solution?: string | null;
  hasSolution?: boolean;
  solutionSvg?: string;
  solutionImageUrl?: string;
  isUncertain?: boolean;
  uncertaintyReason?: string;
  photoIndex?: number;
}

export interface MarkingScheme {
  pattern: MarkingPatternType;
  // JEE Main standard: +4 for correct, -1 for incorrect, 0 for unattempted
  jeeMain: {
    correct: number;
    incorrect: number;
    unattempted: number;
  };
  // JEE Advanced: supports full marks, step/partial marks, negative marks, unattempted
  jeeAdvanced: {
    fullMarks: number; // e.g. +4
    partialMarks: number; // e.g. +2 (or step mark per correct option)
    incorrectMarks: number; // e.g. -2 or -1
    unattemptedMarks: number; // 0
  };
  // Custom marking scheme
  custom: {
    correct: number;
    partial: number;
    incorrect: number;
    unattempted: number;
  };
}

export interface TestSetupConfig {
  testId: string;
  testName: string;
  durationMinutes: number; // total duration in minutes
  durationHoursInput: number;
  durationMinutesInput: number;
  markingPattern: MarkingPatternType;
  markingScheme: MarkingScheme;
  questions: Question[];
  totalQuestions: number;
  createdAt: string;
}

export type QuestionStatus =
  | 'not_visited'
  | 'unanswered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_and_marked_for_review';

export interface QuestionResult {
  questionId: string;
  questionNumber: number;
  subject: SubjectType;
  type: QuestionType;
  questionText: string;
  options: Option[];
  imageUrl?: string;
  solution?: string | null;
  hasSolution?: boolean;
  solutionSvg?: string;
  solutionImageUrl?: string;
  diagramSvg?: string;
  diagramDescription?: string;
  userAnswer: string | string[] | null;
  correctAnswer: string | string[];
  outcome: QuestionOutcome;
  marksAwarded: number;
  maxMarks: number;
  negativeMarks: number;
  timeSpentSeconds: number;
  isUncertain?: boolean;
}

export interface SubjectPerformance {
  subject: SubjectType;
  totalQuestions: number;
  attempted: number;
  correct: number;
  partiallyCorrect: number;
  incorrect: number;
  unattempted: number;
  scoreObtained: number;
  maxMarks: number;
  accuracy: number;
}

export interface TestResult {
  id: string;
  testId: string;
  testName: string;
  completedAt: string;
  totalDurationMinutes: number;
  totalTimeUsedSeconds: number;
  markingPattern: MarkingPatternType;
  markingScheme: MarkingScheme;
  markingRulesSummary: {
    correct: number;
    partial: number;
    incorrect: number;
    unattempted: number;
  };
  totalQuestions: number;
  totalScore: number;
  maxMarks: number;
  totalAttempted: number;
  totalUnattempted: number;
  totalCorrect: number;
  totalPartiallyCorrect: number;
  totalIncorrect: number;
  percentage: number;
  accuracy: number;
  averageTimePerQuestionSeconds: number;
  averageTimePerAttemptedQuestionSeconds?: number;
  fastestQuestion?: { questionNumber: number; timeSpentSeconds: number; outcome: QuestionOutcome };
  slowestQuestion?: { questionNumber: number; timeSpentSeconds: number; outcome: QuestionOutcome };
  isAutoSubmitted: boolean;
  subjectAnalysis: SubjectPerformance[];
  questionResults: QuestionResult[];
  questions: Question[];
}

export type TestProcessingStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface PreparedTest {
  id: string;
  testTitle: string;
  subject: SubjectType | string;
  createdAt: string;
  status: TestProcessingStatus;
  questions: Question[];
  answerKeyFound?: boolean;
  sourceType: 'pdf' | 'photos' | 'text' | 'sample';
  fileName?: string;
  fileSize?: number;
  totalQuestions: number;
  lastUpdated?: string;
}

export interface ProcessingQueueItem {
  id: string;
  fileName: string;
  fileSize?: number;
  fileType: 'pdf' | 'photos' | 'text';
  status: TestProcessingStatus;
  progressPercent: number;
  stage: string;
  questionsIdentified: number;
  answersFound: number;
  imagesDetected: number;
  approxTimeRemaining: string;
  errorMessage?: string;
  pdfBase64?: string;
  images?: Array<{ base64: string; mimeType: string; name?: string; previewUrl?: string }>;
  textContent?: string;
  addedAt: number;
  completedTestId?: string;
}
