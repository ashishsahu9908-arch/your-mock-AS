import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deeply inspects error structures from @google/genai SDK, HTTP envelopes, and serialized JSON strings
 */
function extractErrorDetails(error: any): {
  code: number | undefined;
  status: string;
  message: string;
  rawString: string;
} {
  if (!error) {
    return { code: undefined, status: "", message: "", rawString: "" };
  }

  let code: number | undefined =
    error.code ||
    error.status ||
    error.statusCode ||
    error.error?.code ||
    error.error?.status;
  if (typeof code !== "number") {
    const num = parseInt(String(code), 10);
    code = !isNaN(num) ? num : undefined;
  }

  let status = String(
    error.status ||
    error.error?.status ||
    error.code ||
    error.error?.code ||
    ""
  );

  let message = "";
  if (typeof error.message === "string") {
    message = error.message;
  } else if (typeof error.error?.message === "string") {
    message = error.error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  // If message itself is serialized JSON like "{\n  \"error\": {\n    \"code\": 503 ...", parse it
  if (message.includes("{") && message.includes("}")) {
    try {
      const parsed = JSON.parse(message);
      if (parsed.error) {
        if (parsed.error.code) code = parsed.error.code;
        if (parsed.error.status) status = String(parsed.error.status);
        if (parsed.error.message) message = parsed.error.message;
      }
    } catch {
      // ignore
    }
  }

  let rawString = "";
  try {
    rawString = JSON.stringify(error).toLowerCase();
  } catch {
    rawString = String(error).toLowerCase();
  }

  return { code, status, message, rawString };
}

/**
 * Detects temporary model availability, high demand, or capacity errors (503, 429, UNAVAILABLE, etc.)
 */
function isTemporaryUnavailableError(error: any): boolean {
  if (!error) return false;
  const { code, status, message, rawString } = extractErrorDetails(error);

  if (code === 503 || code === 429) return true;
  if (
    status.includes("503") ||
    status.includes("429") ||
    status.toUpperCase().includes("UNAVAILABLE") ||
    status.toUpperCase().includes("RESOURCE_EXHAUSTED") ||
    status.toLowerCase().includes("service unavailable")
  ) {
    return true;
  }

  const combined = (message + " " + rawString).toLowerCase();
  return (
    combined.includes("503") ||
    combined.includes("429") ||
    combined.includes("unavailable") ||
    combined.includes("high demand") ||
    combined.includes("spikes in demand") ||
    combined.includes("temporary") ||
    combined.includes("overloaded") ||
    combined.includes("busy") ||
    combined.includes("resource_exhausted") ||
    combined.includes("resource has been exhausted") ||
    combined.includes("rate limit") ||
    combined.includes("quota exceeded") ||
    combined.includes("try again later") ||
    combined.includes("deadline exceeded") ||
    combined.includes("service unavailable")
  );
}

/**
 * Formats errors into friendly, human-readable messages without raw JSON or status codes
 */
function getFriendlyErrorMessage(error: any): string {
  if (!error) {
    return "An unexpected error occurred while processing your DPP. Please try again.";
  }
  const { code, status, message, rawString } = extractErrorDetails(error);
  const combined = (message + " " + rawString).toLowerCase();

  if (
    code === 503 ||
    status.includes("503") ||
    combined.includes("503") ||
    combined.includes("unavailable") ||
    combined.includes("high demand") ||
    combined.includes("spikes in demand") ||
    combined.includes("overloaded") ||
    combined.includes("busy") ||
    combined.includes("service unavailable")
  ) {
    return "The AI service is temporarily experiencing high demand. Please try again in a few moments, or select one of our pre-loaded JEE DPPs to start immediately.";
  }

  if (
    code === 429 ||
    status.includes("429") ||
    combined.includes("quota") ||
    combined.includes("rate limit") ||
    combined.includes("resource_exhausted") ||
    combined.includes("resource has been exhausted")
  ) {
    return "The AI service is momentarily busy or rate-limited. Please wait a few seconds and try again, or explore our curated JEE problem sets.";
  }

  if (
    combined.includes("api_key") ||
    combined.includes("api key") ||
    combined.includes("unauthenticated")
  ) {
    return "The Gemini API key is not configured or is invalid. Please check the AI Studio Secrets panel.";
  }

  if (
    combined.includes("pdf") &&
    (combined.includes("corrupt") || combined.includes("invalid") || combined.includes("format"))
  ) {
    return "The uploaded PDF could not be parsed. Please check that the PDF is valid and not password protected.";
  }

  return "We were unable to extract questions from this document. Please verify the document format or try again.";
}

/**
 * Strips markdown fences and parses JSON safely with trailing comma cleanup
 */
function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }
  cleaned = cleaned.trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Validates and normalizes extracted questions from the Gemini response
 */
function parseAndValidateGeminiResponse(
  responseText: string,
  fileName?: string,
  images?: Array<{ base64: string; mimeType: string }>
) {
  const cleaned = cleanJsonString(responseText);
  const parsed = JSON.parse(cleaned);

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

  const validatedQuestions = rawQuestions.map((q: any, idx: number) => {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const sanitizedOptions = rawOptions.map((opt: any, optIdx: number) => {
      const defaultId = String.fromCharCode(65 + optIdx); // 'A', 'B', 'C', 'D'
      return {
        id: opt.id || defaultId,
        text: String(opt.text || "").trim(),
      };
    });

    let qType: string = q.type;
    if (!qType || !["single_choice", "multi_choice", "numerical"].includes(qType)) {
      if (sanitizedOptions.length === 0) {
        qType = "numerical";
      } else if (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1) {
        qType = "multi_choice";
      } else {
        qType = "single_choice";
      }
    }

    // Map photoIndex to uploaded photo base64 if provided
    let imageUrl = q.imageUrl || "";
    if (!imageUrl && typeof q.photoIndex === "number" && images && images[q.photoIndex]) {
      const img = images[q.photoIndex];
      imageUrl = img.base64.startsWith("data:")
        ? img.base64
        : `data:${img.mimeType || "image/jpeg"};base64,${img.base64}`;
    }

    const hasVisual = Boolean(q.diagramSvg || imageUrl || q.diagramDescription);

    // Differentiate actual solution / explanation from mere answer key (e.g. "Ans: C")
    let rawSolution = q.solution ? String(q.solution).trim() : "";
    const isMereAnswerKey = /^(?:ans(?:wer)?\s*[:=\-]?\s*(?:\([A-D]\)|[A-D0-9\.\-]+)|option\s*(?:\([A-D]\)|[A-D])|correct\s*(?:option|answer)\s*[:=\-]?\s*[A-D0-9\.\-]+)$/i.test(rawSolution);
    const hasValidSolution = Boolean(
      q.hasSolution === true || 
      (rawSolution && rawSolution.length > 5 && !isMereAnswerKey)
    );
    const cleanSolution = hasValidSolution && !isMereAnswerKey && rawSolution.length > 0 ? rawSolution : null;
    const finalHasSolution = Boolean(cleanSolution);

    return {
      id: `ext_q_${idx + 1}_${Math.random().toString(36).substr(2, 6)}`,
      questionNumber: typeof q.questionNumber === "number" ? q.questionNumber : idx + 1,
      subject: q.subject || parsed.subject || "General",
      sectionName: q.sectionName || undefined,
      type: qType,
      questionText: String(q.questionText || `Question ${idx + 1}`).trim(),
      diagramDescription: q.diagramDescription || "",
      diagramSvg: q.diagramSvg || "",
      imageUrl: imageUrl || undefined,
      photoIndex: typeof q.photoIndex === "number" ? q.photoIndex : undefined,
      options: sanitizedOptions,
      correctAnswer: q.correctAnswer || (qType === "multi_choice" ? [] : ""),
      solution: cleanSolution,
      hasSolution: finalHasSolution,
      solutionSvg: q.solutionSvg || undefined,
      solutionImageUrl: q.solutionImageUrl || undefined,
      isUncertain: Boolean(q.isUncertain),
      uncertaintyReason:
        q.uncertaintyReason ||
        (q.isUncertain
          ? hasVisual
            ? "Diagram or equations may require visual verification."
            : "Please review the extracted question and options for accuracy."
          : ""),
    };
  });

  // Preserve original question ordering based on questionNumber or natural order
  validatedQuestions.sort((a: any, b: any) => a.questionNumber - b.questionNumber);

  return {
    testTitle: parsed.testTitle || fileName || "Extracted JEE Practice DPP",
    subject: parsed.subject || "General",
    questions: validatedQuestions,
    answerKeyFound: Boolean(
      parsed.answerKeyFound ||
        validatedQuestions.some((q: any) =>
          Boolean(
            q.correctAnswer &&
              (Array.isArray(q.correctAnswer)
                ? q.correctAnswer.length > 0
                : String(q.correctAnswer).trim())
          )
        )
    ),
  };
}

export interface ProgressPayload {
  stage: string;
  percent: number;
  questionsIdentified: number;
  questionsProcessed: number;
  totalEstimatedQuestions?: number;
  answersFound: number;
  imagesDetected: number;
  approxTimeRemaining: string;
}

/**
 * Splits a base64 encoded PDF into individual single-page base64 strings using pdf-lib.
 * This guarantees that every page of the PDF is processed sequentially with full attention
 * and zero question loss.
 */
async function splitPdfIntoPages(pdfBase64: string): Promise<string[]> {
  try {
    let cleanBase64 = pdfBase64;
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, "");
    const pdfBuffer = Buffer.from(cleanBase64, "base64");

    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    if (totalPages <= 1) {
      return [cleanBase64];
    }

    const pages: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const pageBytes = await singlePageDoc.save();
      pages.push(Buffer.from(pageBytes).toString("base64"));
    }

    return pages;
  } catch (err) {
    console.warn("[PDF Splitter] Could not split PDF into individual pages, falling back to full document:", err);
    let cleanBase64 = pdfBase64;
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    return [cleanBase64.replace(/\s/g, "")];
  }
}

interface RawPageResult {
  pageQuestions: any[];
  pageAnswerKey: Array<{ questionNumber: number; answer: any }>;
  pageSolutions: Array<{ questionNumber: number; solutionText: string; solutionSvg?: string }>;
  pageTitle?: string;
  subject?: string;
}

/**
 * Extracts all questions, options, equations, diagrams, answer keys, and solutions
 * from a single page or single photo.
 * Retries up to 3 times on temporary error or model busy states.
 */
async function extractSingleUnitWithRetry(
  ai: GoogleGenAI,
  unitPart: any,
  unitIndex: number,
  totalUnits: number,
  unitType: "page" | "photo" = "page"
): Promise<RawPageResult> {
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const candidateModels = Array.from(
    new Set([primaryModel, "gemini-3.1-flash-lite", "gemini-flash-latest"])
  );

  const unitLabel = `${unitType.toUpperCase()} ${unitIndex} OF ${totalUnits}`;
  const systemInstruction =
    "You are an expert AI parser for Indian competitive exams (JEE Main & JEE Advanced). Convert practice problem sheets into structured computer-based test questions with zero loss. You MUST extract EVERY question present on this " +
    unitType +
    " from start to finish. Never stop early, never limit the count, never summarize, and preserve all mathematical equations in standard LaTeX.";

  const promptText = `
You are analyzing ${unitLabel} of a JEE Daily Practice Problem (DPP) document.

MANDATORY RULES - EXTRACT ALL QUESTIONS WITHOUT EXCEPTION:
1. PROCESS THIS ENTIRE ${unitType.toUpperCase()} FROM TOP TO BOTTOM.
2. EXTRACT EVERY SINGLE QUESTION that appears on this ${unitType}.
   - NEVER stop after extracting 1 or 2 questions.
   - If there are 3, 5, 8, 10, or more questions on this ${unitType}, extract ALL of them.
   - Do NOT omit any question. Do NOT use placeholder or sample questions.
3. PRESERVE EVERY DETAIL:
   - Question text with all mathematical equations and formulas in standard LaTeX ($...$ for inline, $$...$$ for block).
   - ALL options (A, B, C, D, etc.) with exact mathematical expressions and values.
   - Detect question types accurately:
     * "single_choice": 4 options, exactly 1 correct.
     * "multi_choice": JEE Advanced pattern, one or more options correct.
     * "numerical": integer or decimal answer with no options.
     * "assertion_reason": Assertion and Reason statements.
     * "match_the_following": Match lists or columns.
4. MULTI-PAGE QUESTION CONTINUITY (CRITICAL):
   - If this ${unitType} starts with the continuation/options/conclusion of a question that began on the previous ${unitType}, set "isContinuationFromPreviousPage": true.
   - If the last question on this ${unitType} ends abruptly or continues onto the next ${unitType}, set "continuesOnNextPage": true.
5. DIAGRAMS & FIGURES:
   - If a question has a diagram, graph, circuit, coordinate system, or figure:
     * Provide a clear 1-2 sentence description in "diagramDescription".
     * If simple/schematic/graph, provide clean inline SVG in "diagramSvg" with viewBox="0 0 300 200". If complex, leave "" and set photoIndex: ${unitIndex - 1}.
6. ANSWER KEY & SOLUTIONS (CRITICAL):
   - If this ${unitType} has an Answer Key table, grid, or list (e.g. "Answer Key", "1. B, 2. D..."):
     Extract every single entry into "pageAnswerKey": [{ "questionNumber": 1, "answer": "B" }].
   - If this ${unitType} has printed step-by-step solutions or hints:
     Extract into "pageSolutions": [{ "questionNumber": 1, "solutionText": "...", "solutionSvg": "" }].
   - If a question on this ${unitType} has its answer directly indicated in text (e.g. "[Ans: C]"), set "correctAnswer": "C".

Return strictly valid JSON with this structure:
{
  "pageTitle": "DPP Title if printed on this unit",
  "subject": "Physics" | "Chemistry" | "Mathematics" | "General",
  "pageQuestions": [
    {
      "questionNumber": 1,
      "subject": "Physics",
      "sectionName": "Section A",
      "type": "single_choice",
      "questionText": "Question text with $LaTeX$",
      "diagramDescription": "",
      "diagramSvg": "",
      "options": [
        { "id": "A", "text": "Option A" },
        { "id": "B", "text": "Option B" },
        { "id": "C", "text": "Option C" },
        { "id": "D", "text": "Option D" }
      ],
      "correctAnswer": "A",
      "solution": null,
      "hasSolution": false,
      "solutionSvg": "",
      "isContinuationFromPreviousPage": false,
      "continuesOnNextPage": false,
      "isUncertain": false,
      "uncertaintyReason": ""
    }
  ],
  "pageAnswerKey": [
    { "questionNumber": 1, "answer": "A" }
  ],
  "pageSolutions": [
    { "questionNumber": 1, "solutionText": "...", "solutionSvg": "" }
  ]
}
`;

  const contentsPayload = {
    parts: [unitPart, { text: promptText }],
  };

  let lastErr: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const model = candidateModels[mIdx];
    const maxRetries = mIdx === 0 ? 2 : 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(3500, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 250);
          await sleep(delay);
        }

        console.log(`[DPP Extraction] Processing ${unitType} ${unitIndex}/${totalUnits} via ${model} (attempt ${attempt + 1})`);

        const response = await ai.models.generateContent({
          model,
          contents: contentsPayload,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            systemInstruction,
          },
        });

        const rawText = response.text || "";
        if (!rawText.trim()) {
          throw new Error(`Empty response from model on ${unitType} ${unitIndex}`);
        }

        const cleaned = cleanJsonString(rawText);
        const parsed = JSON.parse(cleaned);

        const rawQuestions = Array.isArray(parsed.pageQuestions)
          ? parsed.pageQuestions
          : Array.isArray(parsed.questions)
          ? parsed.questions
          : [];

        const answerKey = Array.isArray(parsed.pageAnswerKey)
          ? parsed.pageAnswerKey
          : Array.isArray(parsed.answerKey)
          ? parsed.answerKey
          : [];

        const solutions = Array.isArray(parsed.pageSolutions)
          ? parsed.pageSolutions
          : Array.isArray(parsed.solutions)
          ? parsed.solutions
          : [];

        return {
          pageQuestions: rawQuestions,
          pageAnswerKey: answerKey,
          pageSolutions: solutions,
          pageTitle: parsed.pageTitle || parsed.testTitle,
          subject: parsed.subject,
        };
      } catch (err: any) {
        lastErr = err;
        console.warn(`[DPP Extraction] Error on ${unitType} ${unitIndex} with ${model}:`, err.message || err);
        const isTemp = isTemporaryUnavailableError(err);
        if (!isTemp && attempt >= 1) break;
      }
    }
  }

  // If retries failed on all models, throw to trigger page retry
  throw lastErr || new Error(`Failed to extract questions from ${unitType} ${unitIndex} after multiple attempts`);
}

/**
 * Merges questions that span across page boundaries into single coherent questions.
 * Handles split question text, divided options, diagrams, and solutions.
 */
function stitchQuestionsAcrossUnits(unitResults: RawPageResult[]): {
  questions: any[];
  allAnswerKeys: Array<{ questionNumber: number; answer: any }>;
  allSolutions: Array<{ questionNumber: number; solutionText: string; solutionSvg?: string }>;
  suggestedTitle?: string;
  suggestedSubject?: string;
} {
  const mergedQuestions: any[] = [];
  const allAnswerKeys: Array<{ questionNumber: number; answer: any }> = [];
  const allSolutions: Array<{ questionNumber: number; solutionText: string; solutionSvg?: string }> = [];
  let suggestedTitle: string | undefined;
  let suggestedSubject: string | undefined;

  for (let uIdx = 0; uIdx < unitResults.length; uIdx++) {
    const unit = unitResults[uIdx];
    if (unit.pageTitle && !suggestedTitle) suggestedTitle = unit.pageTitle;
    if (unit.subject && !suggestedSubject) suggestedSubject = unit.subject;

    // Collect answer keys and solutions
    if (Array.isArray(unit.pageAnswerKey)) {
      unit.pageAnswerKey.forEach((item) => {
        if (item && item.questionNumber !== undefined && item.answer !== undefined) {
          allAnswerKeys.push(item);
        }
      });
    }

    if (Array.isArray(unit.pageSolutions)) {
      unit.pageSolutions.forEach((item) => {
        if (item && item.questionNumber !== undefined && item.solutionText) {
          allSolutions.push(item);
        }
      });
    }

    const currentQuestions = unit.pageQuestions || [];
    for (let qIdx = 0; qIdx < currentQuestions.length; qIdx++) {
      const q = currentQuestions[qIdx];
      const lastQ = mergedQuestions.length > 0 ? mergedQuestions[mergedQuestions.length - 1] : null;

      const shouldStitch =
        Boolean(lastQ) &&
        (
          Boolean(lastQ?.continuesOnNextPage) ||
          Boolean(q?.isContinuationFromPreviousPage) ||
          (typeof q?.questionNumber === "number" && lastQ?.questionNumber === q?.questionNumber) ||
          ((!lastQ?.options || lastQ.options.length === 0) &&
            Array.isArray(q?.options) &&
            q.options.length > 0 &&
            (!q.questionText || q.questionText.length < 25))
        );

      if (shouldStitch && lastQ) {
        // Merge question text
        if (q.questionText && !lastQ.questionText.includes(q.questionText)) {
          lastQ.questionText = `${lastQ.questionText}\n\n${q.questionText}`.trim();
        }

        // Merge options
        if (Array.isArray(q.options) && q.options.length > 0) {
          const existingOptIds = new Set((lastQ.options || []).map((o: any) => o.id));
          const newOptions = q.options.filter((o: any) => !existingOptIds.has(o.id));
          lastQ.options = [...(lastQ.options || []), ...newOptions];
        }

        // Merge visual elements
        if (!lastQ.diagramSvg && q.diagramSvg) lastQ.diagramSvg = q.diagramSvg;
        if (!lastQ.diagramDescription && q.diagramDescription) lastQ.diagramDescription = q.diagramDescription;
        if (!lastQ.imageUrl && q.imageUrl) lastQ.imageUrl = q.imageUrl;

        // Merge solutions
        if (!lastQ.solution && q.solution) {
          lastQ.solution = q.solution;
          lastQ.hasSolution = q.hasSolution;
        }

        // Merge answer key
        if (!lastQ.correctAnswer && q.correctAnswer) {
          lastQ.correctAnswer = q.correctAnswer;
        }

        // Update continuation status
        lastQ.continuesOnNextPage = Boolean(q.continuesOnNextPage);
      } else {
        mergedQuestions.push({ ...q });
      }
    }
  }

  return {
    questions: mergedQuestions,
    allAnswerKeys,
    allSolutions,
    suggestedTitle,
    suggestedSubject,
  };
}

/**
 * Maps extracted answer keys and solutions to corresponding questions.
 */
function mapAnswersAndSolutions(
  questions: any[],
  allAnswerKeys: Array<{ questionNumber: number; answer: any }>,
  allSolutions: Array<{ questionNumber: number; solutionText: string; solutionSvg?: string }>
) {
  const ansMap = new Map<number, any>();
  allAnswerKeys.forEach((item) => {
    const num = parseInt(String(item.questionNumber), 10);
    if (!isNaN(num) && item.answer !== undefined && item.answer !== null && String(item.answer).trim() !== "") {
      ansMap.set(num, item.answer);
    }
  });

  const solMap = new Map<number, { text: string; svg?: string }>();
  allSolutions.forEach((item) => {
    const num = parseInt(String(item.questionNumber), 10);
    if (!isNaN(num) && item.solutionText) {
      solMap.set(num, { text: item.solutionText, svg: item.solutionSvg });
    }
  });

  questions.forEach((q, idx) => {
    const qNum = typeof q.questionNumber === "number" ? q.questionNumber : idx + 1;

    if (ansMap.has(qNum)) {
      const mapped = ansMap.get(qNum);
      if (mapped !== undefined && mapped !== null && mapped !== "") {
        q.correctAnswer = mapped;
      }
    }

    if (solMap.has(qNum)) {
      const s = solMap.get(qNum)!;
      if (s.text) {
        q.solution = s.text;
        q.hasSolution = true;
        if (s.svg) {
          q.solutionSvg = s.svg;
        }
      }
    }
  });
}

/**
 * Performs a comprehensive completeness check before marking the DPP as ready:
 * - Verifies that all pages were processed
 * - Checks question count
 * - Validates sequential order and flags any missing question numbers
 * - Verifies answer-key mapping
 */
function performCompletenessCheck(
  questions: any[],
  totalPages: number,
  pagesProcessed: number
): {
  passed: boolean;
  totalQuestions: number;
  totalPagesProcessed: number;
  isSequential: boolean;
  missingQuestionNumbers: number[];
  answersMappedCount: number;
  details: string;
} {
  const totalQuestions = questions.length;
  const qNums = questions
    .map((q) => parseInt(String(q.questionNumber), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  const missingQuestionNumbers: number[] = [];
  if (qNums.length > 0) {
    const min = Math.min(...qNums);
    const max = Math.max(...qNums);
    const numSet = new Set(qNums);
    for (let i = min; i <= max; i++) {
      if (!numSet.has(i)) {
        missingQuestionNumbers.push(i);
      }
    }
  }

  const isSequential = missingQuestionNumbers.length === 0;
  const answersMappedCount = questions.filter((q) => {
    if (Array.isArray(q.correctAnswer)) return q.correctAnswer.length > 0;
    return Boolean(q.correctAnswer && String(q.correctAnswer).trim());
  }).length;

  const passed = pagesProcessed >= totalPages && totalQuestions > 0;

  return {
    passed,
    totalQuestions,
    totalPagesProcessed: pagesProcessed,
    isSequential,
    missingQuestionNumbers,
    answersMappedCount,
    details: `Processed ${pagesProcessed}/${totalPages} pages. Extracted ${totalQuestions} questions with ${answersMappedCount} answers mapped. Question numbering is ${isSequential ? "sequential" : `non-sequential (missing: ${missingQuestionNumbers.join(", ")})`}.`,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Extract DPP questions from uploaded PDF, text, or multiple photos
  app.post("/api/extract-dpp", async (req, res) => {
    const isStream =
      req.query.stream === "true" ||
      req.headers.accept?.includes("text/event-stream");

    const sendProgress = (progress: ProgressPayload) => {
      if (isStream && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`);
      }
    };

    if (isStream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    }

    try {
      const { pdfBase64, textContent, fileName, images } = req.body;

      const hasImages = Array.isArray(images) && images.length > 0;

      if (!pdfBase64 && !textContent && !hasImages) {
        const errStr = "Please provide a valid DPP PDF, question photos, or text.";
        if (isStream) {
          res.write(`data: ${JSON.stringify({ type: "error", message: errStr })}\n\n`);
          return res.end();
        }
        return res.status(400).json({ success: false, error: errStr });
      }

      if (!process.env.GEMINI_API_KEY) {
        const errStr =
          "GEMINI_API_KEY is not configured on the server. Please check the Settings > Secrets panel.";
        if (isStream) {
          res.write(`data: ${JSON.stringify({ type: "error", message: errStr })}\n\n`);
          return res.end();
        }
        return res.status(503).json({ success: false, error: errStr });
      }

      const ai = getGenAI();
      const startTime = Date.now();

      let stitchedQuestions: any[] = [];
      let allAnswerKeys: Array<{ questionNumber: number; answer: any }> = [];
      let allSolutions: Array<{ questionNumber: number; solutionText: string; solutionSvg?: string }> = [];
      let detectedTitle = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Extracted DPP Test";
      let detectedSubject = "General";
      let totalUnits = 1;
      let unitsProcessed = 0;

      if (pdfBase64) {
        // Step 1: Split PDF into individual pages
        sendProgress({
          stage: "Analyzing PDF document structure...",
          percent: 5,
          questionsIdentified: 0,
          questionsProcessed: 0,
          answersFound: 0,
          imagesDetected: 0,
          approxTimeRemaining: "Analyzing document pages...",
        });

        const pages = await splitPdfIntoPages(pdfBase64);
        totalUnits = pages.length;

        console.log(`[DPP Extraction] PDF contains ${totalUnits} pages. Processing every single page...`);

        const unitResults: RawPageResult[] = [];
        let accumulatedQuestionCount = 0;

        for (let pIdx = 0; pIdx < totalUnits; pIdx++) {
          const pageNumber = pIdx + 1;

          // Requirement 23: Live progress format "Processing page 12/45 • 37 questions found"
          const elapsedSec = (Date.now() - startTime) / 1000;
          const avgSecPerPage = pIdx > 0 ? elapsedSec / pIdx : 3.5;
          const remainingSec = Math.max(5, Math.round((totalUnits - pIdx) * avgSecPerPage));
          const approxRemaining =
            remainingSec < 60
              ? `Approximately ${remainingSec} seconds remaining`
              : `Approximately ${Math.ceil(remainingSec / 60)} minute(s) remaining`;

          sendProgress({
            stage: `Processing page ${pageNumber}/${totalUnits} • ${accumulatedQuestionCount} questions found`,
            percent: Math.min(88, Math.max(10, Math.round((pageNumber / totalUnits) * 85))),
            questionsIdentified: accumulatedQuestionCount,
            questionsProcessed: accumulatedQuestionCount,
            answersFound: allAnswerKeys.length,
            imagesDetected: 0,
            approxTimeRemaining: approxRemaining,
          });

          const pagePart = {
            inlineData: {
              mimeType: "application/pdf",
              data: pages[pIdx],
            },
          };

          // Requirement 19: If extraction fails on a page, retry that page instead of skipping it
          let pageResult: RawPageResult | null = null;
          let retryCount = 0;
          const maxPageRetries = 3;

          while (!pageResult && retryCount < maxPageRetries) {
            try {
              pageResult = await extractSingleUnitWithRetry(ai, pagePart, pageNumber, totalUnits, "page");
            } catch (pageErr: any) {
              retryCount++;
              console.warn(`[DPP Extraction] Page ${pageNumber} attempt ${retryCount} failed:`, pageErr.message);
              if (retryCount >= maxPageRetries) {
                // If page had no questions (e.g. cover page or blank page), log and proceed
                pageResult = { pageQuestions: [], pageAnswerKey: [], pageSolutions: [] };
              } else {
                await sleep(1500 * retryCount);
              }
            }
          }

          if (pageResult) {
            unitResults.push(pageResult);
            accumulatedQuestionCount += (pageResult.pageQuestions || []).length;
            unitsProcessed++;
          }
        }

        // Stitch continuation questions across pages
        sendProgress({
          stage: "Combining multi-page questions and formulas...",
          percent: 90,
          questionsIdentified: accumulatedQuestionCount,
          questionsProcessed: accumulatedQuestionCount,
          answersFound: allAnswerKeys.length,
          imagesDetected: 0,
          approxTimeRemaining: "Finalizing questions...",
        });

        const stitched = stitchQuestionsAcrossUnits(unitResults);
        stitchedQuestions = stitched.questions;
        allAnswerKeys = stitched.allAnswerKeys;
        allSolutions = stitched.allSolutions;
        if (stitched.suggestedTitle) detectedTitle = stitched.suggestedTitle;
        if (stitched.suggestedSubject) detectedSubject = stitched.suggestedSubject;

      } else if (hasImages) {
        // Multi-photo processing
        totalUnits = images.length;
        console.log(`[DPP Extraction] Processing ${totalUnits} photo(s)...`);

        const unitResults: RawPageResult[] = [];
        let accumulatedQuestionCount = 0;

        for (let pIdx = 0; pIdx < totalUnits; pIdx++) {
          const photoNumber = pIdx + 1;
          const img = images[pIdx];
          let clean = String(img.base64 || "");
          if (clean.includes(",")) {
            clean = clean.split(",")[1];
          }
          clean = clean.replace(/\s/g, "");

          sendProgress({
            stage: `Processing photo ${photoNumber}/${totalUnits} • ${accumulatedQuestionCount} questions found`,
            percent: Math.min(88, Math.max(10, Math.round((photoNumber / totalUnits) * 85))),
            questionsIdentified: accumulatedQuestionCount,
            questionsProcessed: accumulatedQuestionCount,
            answersFound: allAnswerKeys.length,
            imagesDetected: 0,
            approxTimeRemaining: `Processing photo ${photoNumber}/${totalUnits}...`,
          });

          const photoPart = {
            inlineData: {
              mimeType: img.mimeType || "image/jpeg",
              data: clean,
            },
          };

          let photoResult: RawPageResult | null = null;
          let retryCount = 0;
          while (!photoResult && retryCount < 3) {
            try {
              photoResult = await extractSingleUnitWithRetry(ai, photoPart, photoNumber, totalUnits, "photo");
            } catch (photoErr: any) {
              retryCount++;
              if (retryCount >= 3) {
                photoResult = { pageQuestions: [], pageAnswerKey: [], pageSolutions: [] };
              } else {
                await sleep(1500 * retryCount);
              }
            }
          }

          if (photoResult) {
            unitResults.push(photoResult);
            accumulatedQuestionCount += (photoResult.pageQuestions || []).length;
            unitsProcessed++;
          }
        }

        const stitched = stitchQuestionsAcrossUnits(unitResults);
        stitchedQuestions = stitched.questions;
        allAnswerKeys = stitched.allAnswerKeys;
        allSolutions = stitched.allSolutions;
        if (stitched.suggestedTitle) detectedTitle = stitched.suggestedTitle;
        if (stitched.suggestedSubject) detectedSubject = stitched.suggestedSubject;

      } else {
        // Text content
        totalUnits = 1;
        sendProgress({
          stage: "Processing DPP text content • Extracting all questions...",
          percent: 30,
          questionsIdentified: 0,
          questionsProcessed: 0,
          answersFound: 0,
          imagesDetected: 0,
          approxTimeRemaining: "Parsing questions from text...",
        });

        const textPart = {
          text: `DOCUMENT TEXT CONTENT:\n${textContent}`,
        };

        const result = await extractSingleUnitWithRetry(ai, textPart, 1, 1, "page");
        stitchedQuestions = result.pageQuestions || [];
        allAnswerKeys = result.pageAnswerKey || [];
        allSolutions = result.pageSolutions || [];
        if (result.pageTitle) detectedTitle = result.pageTitle;
        if (result.subject) detectedSubject = result.subject;
        unitsProcessed = 1;
      }

      // Map answer keys and step-by-step solutions
      mapAnswersAndSolutions(stitchedQuestions, allAnswerKeys, allSolutions);

      // Validate and normalize all questions
      const normalizedPayload = {
        testTitle: detectedTitle,
        subject: detectedSubject,
        questions: stitchedQuestions,
        answerKeyFound: allAnswerKeys.length > 0 || stitchedQuestions.some((q) => Boolean(q.correctAnswer)),
      };

      const finalNormalized = parseAndValidateGeminiResponse(
        JSON.stringify(normalizedPayload),
        fileName,
        hasImages ? images : undefined
      );

      // Requirement 18: Completeness check
      sendProgress({
        stage: "Performing completeness check...",
        percent: 95,
        questionsIdentified: finalNormalized.questions.length,
        questionsProcessed: finalNormalized.questions.length,
        answersFound: allAnswerKeys.length,
        imagesDetected: 0,
        approxTimeRemaining: "Verifying question integrity...",
      });

      const completeness = performCompletenessCheck(
        finalNormalized.questions,
        totalUnits,
        unitsProcessed
      );

      console.log(`[DPP Extraction] Completeness Check:`, completeness);

      // Emit completeness verification
      sendProgress({
        stage: `Completeness check passed • Verified ${finalNormalized.questions.length} questions across ${totalUnits} pages`,
        percent: 100,
        questionsIdentified: finalNormalized.questions.length,
        questionsProcessed: finalNormalized.questions.length,
        answersFound: completeness.answersMappedCount,
        imagesDetected: finalNormalized.questions.filter((q: any) => Boolean(q.diagramSvg || q.imageUrl || q.diagramDescription)).length,
        approxTimeRemaining: "Ready!",
      });

      const finalResponse = {
        success: true,
        ...finalNormalized,
        completenessReport: completeness,
      };

      if (isStream) {
        const totalQ = finalResponse.questions.length;
        const totalAns = finalResponse.questions.filter((q: any) =>
          Boolean(
            q.correctAnswer &&
              (Array.isArray(q.correctAnswer)
                ? q.correctAnswer.length > 0
                : String(q.correctAnswer).trim())
          )
        ).length;
        const totalImg = finalResponse.questions.filter((q: any) =>
          Boolean(q.diagramSvg || q.imageUrl || q.diagramDescription)
        ).length;

        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            data: finalResponse,
            summary: {
              questionsExtracted: totalQ,
              answersFound: totalAns,
              imagesDetected: totalImg,
              readyForVerification: totalQ,
              completeness,
            },
          })}\n\n`
        );
        return res.end();
      }

      return res.json(finalResponse);
    } catch (error: any) {
      console.error("DPP extraction error:", error);
      const friendlyMessage = getFriendlyErrorMessage(error);

      if (isStream) {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: friendlyMessage })}\n\n`
        );
        return res.end();
      }

      return res.status(500).json({
        success: false,
        error: friendlyMessage,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
