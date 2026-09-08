import { Question, MarkingScheme, QuestionResult, SubjectPerformance, SubjectType, TestResult, QuestionOutcome } from '../types';

export const DEFAULT_MARKING_SCHEME: MarkingScheme = {
  pattern: 'jee_main',
  jeeMain: {
    correct: 4,
    incorrect: -1,
    unattempted: 0,
  },
  jeeAdvanced: {
    fullMarks: 4,
    partialMarks: 2,
    incorrectMarks: -2,
    unattemptedMarks: 0,
  },
  custom: {
    correct: 4,
    partial: 2,
    incorrect: -1,
    unattempted: 0,
  },
};

/**
 * Normalizes answer for comparison (trims, uppercase, sorted for arrays)
 */
export function normalizeAnswer(ans: string | string[] | null | undefined): string[] {
  if (!ans) return [];
  if (Array.isArray(ans)) {
    return ans.map(a => a.trim().toUpperCase()).filter(Boolean).sort();
  }
  const str = ans.toString().trim().toUpperCase();
  if (!str) return [];
  if (str.includes(',')) {
    return str.split(',').map(s => s.trim()).filter(Boolean).sort();
  }
  return [str];
}

/**
 * Evaluate single question result based on selected marking pattern and rules
 */
export function evaluateQuestion(
  q: Question,
  userAnswer: string | string[] | null | undefined,
  markingScheme: MarkingScheme,
  timeSpentSeconds: number = 0
): QuestionResult {
  const userAnsArray = normalizeAnswer(userAnswer);
  const correctAnsArray = normalizeAnswer(q.correctAnswer);
  const isAttempted = userAnsArray.length > 0;

  let outcome: QuestionOutcome = 'unattempted';
  let marksAwarded = 0;
  let maxMarks = 4;
  let negativeMarks = 0;

  const pattern = markingScheme.pattern;
  let correctMark = 4;
  let partialMark = 2;
  let incorrectMark = -1;
  let unattemptedMark = 0;

  if (pattern === 'jee_main') {
    correctMark = markingScheme.jeeMain.correct;
    incorrectMark = markingScheme.jeeMain.incorrect;
    unattemptedMark = markingScheme.jeeMain.unattempted;
    partialMark = 0;
  } else if (pattern === 'jee_advanced') {
    correctMark = markingScheme.jeeAdvanced.fullMarks;
    partialMark = markingScheme.jeeAdvanced.partialMarks;
    incorrectMark = markingScheme.jeeAdvanced.incorrectMarks;
    unattemptedMark = markingScheme.jeeAdvanced.unattemptedMarks;
  } else {
    correctMark = markingScheme.custom.correct;
    partialMark = markingScheme.custom.partial;
    incorrectMark = markingScheme.custom.incorrect;
    unattemptedMark = markingScheme.custom.unattempted;
  }

  maxMarks = correctMark;

  if (!isAttempted) {
    outcome = 'unattempted';
    marksAwarded = unattemptedMark;
  } else if (q.type === 'numerical') {
    const uVal = userAnsArray[0]?.trim();
    const cVal = correctAnsArray[0]?.trim();
    const uNum = parseFloat(uVal);
    const cNum = parseFloat(cVal);

    const isMatch = !isNaN(uNum) && !isNaN(cNum) 
      ? Math.abs(uNum - cNum) < 0.01 
      : uVal === cVal;

    if (isMatch) {
      outcome = 'fully_correct';
      marksAwarded = correctMark;
    } else {
      outcome = 'incorrect';
      marksAwarded = incorrectMark;
      negativeMarks = Math.abs(incorrectMark);
    }
  } else if (q.type === 'multi_choice') {
    const hasWrongChoice = userAnsArray.some(ans => !correctAnsArray.includes(ans));
    const correctChoicesSelected = userAnsArray.filter(ans => correctAnsArray.includes(ans));

    if (hasWrongChoice) {
      outcome = 'incorrect';
      marksAwarded = incorrectMark;
      negativeMarks = Math.abs(incorrectMark);
    } else if (correctChoicesSelected.length === correctAnsArray.length && correctAnsArray.length > 0) {
      outcome = 'fully_correct';
      marksAwarded = correctMark;
    } else if (correctChoicesSelected.length > 0) {
      if (pattern === 'jee_advanced' || pattern === 'custom') {
        outcome = 'partially_correct';
        const step = Math.max(1, Math.round(correctMark / Math.max(1, correctAnsArray.length)));
        marksAwarded = Math.min(correctMark, correctChoicesSelected.length * step);
      } else {
        outcome = 'incorrect';
        marksAwarded = incorrectMark;
        negativeMarks = Math.abs(incorrectMark);
      }
    } else {
      outcome = 'unattempted';
      marksAwarded = unattemptedMark;
    }
  } else {
    const uVal = userAnsArray[0];
    const cVal = correctAnsArray[0];

    if (uVal === cVal) {
      outcome = 'fully_correct';
      marksAwarded = correctMark;
    } else {
      outcome = 'incorrect';
      marksAwarded = incorrectMark;
      negativeMarks = Math.abs(incorrectMark);
    }
  }

  return {
    questionId: q.id,
    questionNumber: q.questionNumber,
    subject: q.subject,
    type: q.type,
    questionText: q.questionText,
    options: q.options,
    imageUrl: q.imageUrl,
    solution: q.solution || null,
    hasSolution: q.hasSolution ?? Boolean(q.solution && String(q.solution).trim().length > 0),
    solutionSvg: q.solutionSvg,
    solutionImageUrl: q.solutionImageUrl,
    diagramSvg: q.diagramSvg,
    diagramDescription: q.diagramDescription,
    userAnswer: userAnsArray.length <= 1 ? (userAnsArray[0] ?? null) : userAnsArray,
    correctAnswer: correctAnsArray.length <= 1 ? (correctAnsArray[0] ?? '') : correctAnsArray,
    outcome,
    marksAwarded,
    maxMarks,
    negativeMarks,
    timeSpentSeconds,
    isUncertain: q.isUncertain,
  };
}

/**
 * Calculate complete test result from questions and responses
 */
export function calculateTestResult(
  testId: string,
  testName: string,
  durationMinutes: number,
  totalTimeUsedSeconds: number,
  markingScheme: MarkingScheme,
  questions: Question[],
  userResponses: Record<string, string | string[]>,
  timeSpentPerQuestion: Record<string, number>,
  isAutoSubmitted: boolean
): TestResult {
  const questionResults = questions.map(q => {
    const userAns = userResponses[q.id];
    const timeSpent = timeSpentPerQuestion[q.id] || 0;
    return evaluateQuestion(q, userAns, markingScheme, timeSpent);
  });

  let totalScore = 0;
  let maxMarks = 0;
  let totalAttempted = 0;
  let totalUnattempted = 0;
  let totalCorrect = 0;
  let totalPartiallyCorrect = 0;
  let totalIncorrect = 0;

  const subjectMap: Record<string, SubjectPerformance> = {};

  questionResults.forEach(qr => {
    totalScore += qr.marksAwarded;
    maxMarks += qr.maxMarks;

    const sub = qr.subject || 'General';
    if (!subjectMap[sub]) {
      subjectMap[sub] = {
        subject: sub,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        partiallyCorrect: 0,
        incorrect: 0,
        unattempted: 0,
        scoreObtained: 0,
        maxMarks: 0,
        accuracy: 0,
      };
    }

    const subStat = subjectMap[sub];
    subStat.totalQuestions += 1;
    subStat.maxMarks += qr.maxMarks;
    subStat.scoreObtained += qr.marksAwarded;

    if (qr.outcome === 'unattempted') {
      totalUnattempted += 1;
      subStat.unattempted += 1;
    } else {
      totalAttempted += 1;
      subStat.attempted += 1;

      if (qr.outcome === 'fully_correct') {
        totalCorrect += 1;
        subStat.correct += 1;
      } else if (qr.outcome === 'partially_correct') {
        totalPartiallyCorrect += 1;
        subStat.partiallyCorrect += 1;
      } else {
        totalIncorrect += 1;
        subStat.incorrect += 1;
      }
    }
  });

  // Calculate subject accuracies
  Object.values(subjectMap).forEach(s => {
    if (s.attempted > 0) {
      s.accuracy = Math.round(((s.correct + s.partiallyCorrect * 0.5) / s.attempted) * 100);
    } else {
      s.accuracy = 0;
    }
  });

  const accuracy = totalAttempted > 0 
    ? Math.round(((totalCorrect + totalPartiallyCorrect * 0.5) / totalAttempted) * 100) 
    : 0;

  const percentage = maxMarks > 0 
    ? Math.max(0, Math.round((totalScore / maxMarks) * 100)) 
    : 0;

  const averageTimePerQuestionSeconds = questions.length > 0 
    ? Math.round(totalTimeUsedSeconds / questions.length) 
    : 0;

  // Calculate time on attempted questions
  const attemptedResults = questionResults.filter(qr => qr.outcome !== 'unattempted');
  const totalAttemptedTime = attemptedResults.reduce((acc, qr) => acc + qr.timeSpentSeconds, 0);
  const averageTimePerAttemptedQuestionSeconds = attemptedResults.length > 0
    ? Math.round(totalAttemptedTime / attemptedResults.length)
    : averageTimePerQuestionSeconds;

  // Fastest question (minimum time spent > 0, or fallback to first)
  const questionsWithTime = questionResults.filter(qr => qr.timeSpentSeconds > 0);
  let fastestQuestion: { questionNumber: number; timeSpentSeconds: number; outcome: QuestionOutcome } | undefined = undefined;
  let slowestQuestion: { questionNumber: number; timeSpentSeconds: number; outcome: QuestionOutcome } | undefined = undefined;

  if (questionsWithTime.length > 0) {
    const sortedByTime = [...questionsWithTime].sort((a, b) => a.timeSpentSeconds - b.timeSpentSeconds);
    const fastest = sortedByTime[0];
    const slowest = sortedByTime[sortedByTime.length - 1];
    fastestQuestion = {
      questionNumber: fastest.questionNumber,
      timeSpentSeconds: fastest.timeSpentSeconds,
      outcome: fastest.outcome,
    };
    slowestQuestion = {
      questionNumber: slowest.questionNumber,
      timeSpentSeconds: slowest.timeSpentSeconds,
      outcome: slowest.outcome,
    };
  } else if (questionResults.length > 0) {
    fastestQuestion = {
      questionNumber: questionResults[0].questionNumber,
      timeSpentSeconds: questionResults[0].timeSpentSeconds,
      outcome: questionResults[0].outcome,
    };
    slowestQuestion = {
      questionNumber: questionResults[0].questionNumber,
      timeSpentSeconds: questionResults[0].timeSpentSeconds,
      outcome: questionResults[0].outcome,
    };
  }

  let rulesSummary = {
    correct: 4,
    partial: 2,
    incorrect: -1,
    unattempted: 0,
  };

  if (markingScheme.pattern === 'jee_main') {
    rulesSummary = {
      correct: markingScheme.jeeMain.correct,
      partial: 0,
      incorrect: markingScheme.jeeMain.incorrect,
      unattempted: markingScheme.jeeMain.unattempted,
    };
  } else if (markingScheme.pattern === 'jee_advanced') {
    rulesSummary = {
      correct: markingScheme.jeeAdvanced.fullMarks,
      partial: markingScheme.jeeAdvanced.partialMarks,
      incorrect: markingScheme.jeeAdvanced.incorrectMarks,
      unattempted: markingScheme.jeeAdvanced.unattemptedMarks,
    };
  } else {
    rulesSummary = markingScheme.custom;
  }

  return {
    id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    testId,
    testName,
    completedAt: new Date().toISOString(),
    totalDurationMinutes: durationMinutes,
    totalTimeUsedSeconds,
    markingPattern: markingScheme.pattern,
    markingScheme,
    markingRulesSummary: rulesSummary,
    totalQuestions: questions.length,
    totalScore,
    maxMarks,
    totalAttempted,
    totalUnattempted,
    totalCorrect,
    totalPartiallyCorrect,
    totalIncorrect,
    percentage,
    accuracy,
    averageTimePerQuestionSeconds,
    averageTimePerAttemptedQuestionSeconds,
    fastestQuestion,
    slowestQuestion,
    isAutoSubmitted,
    subjectAnalysis: Object.values(subjectMap),
    questionResults,
    questions,
  };
}
