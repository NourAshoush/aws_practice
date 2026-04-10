"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { Question } from "@/types/exam";

type ProgressEntry = {
  correctCount: number;
  wrongCount: number;
  reviewLater: boolean;
  lastResult: "correct" | "wrong" | null;
  lastAnsweredAt: string | null;
};

type ProgressMap = Record<string, ProgressEntry>;
type ActivityMap = Record<string, { attempts: number; correct: number }>;
type QueueFilter = "all" | "unseen" | "seen" | "wrong" | "review" | "done";
type PanelMode = "options" | "progress" | null;
type StudyState = {
  progress: ProgressMap;
  activity: ActivityMap;
  lastQuestionId: string | null;
};

const STORAGE_KEY = "aws-practice-progress-v2";

function Icon({
  name,
  className = "icon"
}: {
  name:
    | "sliders"
    | "chart"
    | "left"
    | "right"
    | "export"
    | "share"
    | "copy"
    | "import"
    | "reset"
    | "flag"
    | "submit"
    | "clear"
    | "new"
    | "seen"
    | "wrong"
    | "review"
    | "done";
  className?: string;
}) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (name) {
    case "sliders":
      return (
        <svg {...props}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="11" cy="18" r="2" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <path d="M4 18h16" />
          <path d="M6 15l4-4 3 2 5-6" />
          <circle cx="6" cy="15" r="1" />
          <circle cx="10" cy="11" r="1" />
          <circle cx="13" cy="13" r="1" />
          <circle cx="18" cy="7" r="1" />
        </svg>
      );
    case "left":
      return (
        <svg {...props}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case "right":
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "export":
      return (
        <svg {...props}>
          <path d="M12 4v10" />
          <path d="M8 8l4-4 4 4" />
          <path d="M5 14v4h14v-4" />
        </svg>
      );
    case "share":
      return (
        <svg {...props}>
          <circle cx="18" cy="5" r="2" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="M8 11l8-5" />
          <path d="M8 13l8 5" />
        </svg>
      );
    case "copy":
      return (
        <svg {...props}>
          <rect x="9" y="9" width="10" height="10" rx="2" />
          <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "import":
      return (
        <svg {...props}>
          <path d="M12 20V10" />
          <path d="M8 16l4 4 4-4" />
          <path d="M5 10V6h14v4" />
        </svg>
      );
    case "reset":
      return (
        <svg {...props}>
          <path d="M4 12a8 8 0 1 0 2.3-5.6" />
          <path d="M4 4v4h4" />
        </svg>
      );
    case "flag":
      return (
        <svg {...props}>
          <path d="M6 20V5" />
          <path d="M6 5h10l-2 3 2 3H6" />
        </svg>
      );
    case "submit":
      return (
        <svg {...props}>
          <path d="M5 12l4 4L19 6" />
        </svg>
      );
    case "clear":
      return (
        <svg {...props}>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      );
    case "new":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 9v6" />
          <path d="M9 12h6" />
        </svg>
      );
    case "seen":
      return (
        <svg {...props}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "wrong":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 9l6 6" />
          <path d="M15 9l-6 6" />
        </svg>
      );
    case "review":
      return (
        <svg {...props}>
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "done":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      );
  }
}

function getEmptyProgressEntry(): ProgressEntry {
  return {
    correctCount: 0,
    wrongCount: 0,
    reviewLater: false,
    lastResult: null,
    lastAnsweredAt: null
  };
}

function sortAnswerKeys(keys: string[]) {
  return [...keys].sort((left, right) => left.localeCompare(right));
}

function isAnswerCorrect(question: Question, selectedAnswers: string[]) {
  const expected = sortAnswerKeys(question.correctAnswers);
  const actual = sortAnswerKeys(selectedAnswers);
  return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProgressEntry(value: unknown): value is ProgressEntry {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.correctCount === "number" &&
    typeof value.wrongCount === "number" &&
    typeof value.reviewLater === "boolean" &&
    (value.lastResult === "correct" || value.lastResult === "wrong" || value.lastResult === null) &&
    (typeof value.lastAnsweredAt === "string" || value.lastAnsweredAt === null)
  );
}

function isProgressMap(value: unknown): value is ProgressMap {
  return isObjectRecord(value) && Object.values(value).every((entry) => isProgressEntry(entry));
}

function isActivityMap(value: unknown): value is ActivityMap {
  return (
    isObjectRecord(value) &&
    Object.values(value).every(
      (entry) =>
        isObjectRecord(entry) && typeof entry.attempts === "number" && typeof entry.correct === "number"
    )
  );
}

function buildExportPayload(studyState: StudyState) {
  return {
    app: "aws-practice-progress",
    version: 2,
    exportedAt: new Date().toISOString(),
    ...studyState
  };
}

function parseStoredState(text: string): StudyState {
  const parsed = JSON.parse(text) as unknown;

  if (
    isObjectRecord(parsed) &&
    "progress" in parsed &&
    isProgressMap(parsed.progress) &&
    (!("activity" in parsed) || isActivityMap(parsed.activity)) &&
    (!("lastQuestionId" in parsed) || typeof parsed.lastQuestionId === "string" || parsed.lastQuestionId === null)
  ) {
    return {
      progress: parsed.progress,
      activity: "activity" in parsed && isActivityMap(parsed.activity) ? parsed.activity : {},
      lastQuestionId: "lastQuestionId" in parsed && (typeof parsed.lastQuestionId === "string" || parsed.lastQuestionId === null)
        ? parsed.lastQuestionId
        : null
    };
  }

  if (isProgressMap(parsed)) {
    return {
      progress: parsed,
      activity: {},
      lastQuestionId: null
    };
  }

  throw new Error("Invalid progress payload");
}

function downloadProgress(studyState: StudyState) {
  const blob = new Blob([JSON.stringify(buildExportPayload(studyState), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "aws-practice-progress.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseExplanation(explanation: string) {
  const [summaryPart, otherOptionsPart] = explanation.split(/\n\s*\nOther options:\n?/);
  const summary = summaryPart.trim();
  const otherOptions = otherOptionsPart
    ? otherOptionsPart
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^- /, ""))
    : [];

  return { summary, otherOptions };
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getQuestionStatus(progressEntry: ProgressEntry | undefined) {
  if (!progressEntry || progressEntry.correctCount + progressEntry.wrongCount === 0) {
    return "unseen";
  }

  if (progressEntry.reviewLater) {
    return "review";
  }

  if (progressEntry.lastResult === "wrong") {
    return "wrong";
  }

  if (progressEntry.wrongCount > 0) {
    return "review";
  }

  return "done";
}

function getQuestionTags(progressEntry: ProgressEntry | undefined) {
  const tags: Array<{
    label: string;
    tone: "neutral" | "success" | "warning" | "danger";
    icon: "new" | "seen" | "wrong" | "review" | "done" | "flag";
  }> = [];
  const attempts = progressEntry ? progressEntry.correctCount + progressEntry.wrongCount : 0;
  const status = getQuestionStatus(progressEntry);

  tags.push({
    label: attempts > 0 ? "Seen" : "New",
    tone: attempts > 0 ? "neutral" : "success",
    icon: attempts > 0 ? "seen" : "new"
  });

  if (status === "wrong") {
    tags.push({ label: "Wrong", tone: "danger", icon: "wrong" });
  } else if (status === "review") {
    tags.push({ label: "Review", tone: "warning", icon: "review" });
  } else if (status === "done") {
    tags.push({ label: "Done", tone: "success", icon: "done" });
  }

  if (progressEntry?.reviewLater) {
    tags.push({ label: "Flagged", tone: "warning", icon: "flag" });
  }

  return tags;
}

function ProgressChart({ activity }: { activity: ActivityMap }) {
  const points = Object.entries(activity)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14);

  if (!points.length) {
    return <div className="small-note">No daily progress yet.</div>;
  }

  const width = 320;
  const height = 120;
  const padding = 12;
  const counts = points.map(([, value]) => value.attempts);
  const maxCount = Math.max(...counts, 1);
  const step = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);

  const coordinates = points.map(([, value], index) => {
    const x = points.length === 1 ? width / 2 : padding + index * step;
    const y = height - padding - ((height - padding * 2) * value.attempts) / maxCount;
    return { x, y, count: value.attempts };
  });

  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? width - padding} ${height - padding} L ${coordinates[0]?.x ?? padding} ${height - padding} Z`;
  const startLabel = points[0]?.[0].slice(5) ?? "";
  const endLabel = points.at(-1)?.[0].slice(5) ?? "";

  return (
    <div className="chart-card">
      <div className="chart-title">Daily attempts</div>
      <svg className="progress-chart" viewBox={`0 0 ${width} ${height}`} aria-label="Daily attempts chart" role="img">
        <path d={areaPath} className="chart-area" />
        <path d={linePath} className="chart-line" />
        {coordinates.map((point) => (
          <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" className="chart-dot" />
        ))}
      </svg>
      <div className="chart-labels">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

export function ExamApp() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activity, setActivity] = useState<ActivityMap>({});
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState("all");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null);
  const [revealedQuestionId, setRevealedQuestionId] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<PanelMode>(null);
  const [transferMessage, setTransferMessage] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const didInitializeCursor = useRef(false);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const response = await fetch("/questions.json");
        if (!response.ok) {
          throw new Error(`Failed to load questions (${response.status})`);
        }

        setQuestions((await response.json()) as Question[]);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load question data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadQuestions();
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("aws-practice-progress-v1");
      if (!stored) {
        return;
      }

      const state = parseStoredState(stored);
      setProgress(state.progress);
      setActivity(state.activity);
      setLastQuestionId(state.lastQuestionId);
    } catch {
      setProgress({});
      setActivity({});
      setLastQuestionId(null);
    }
  }, []);

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const activeQuestions = questions.filter((question) => {
    const progressEntry = progress[question.id];
    const status = getQuestionStatus(progressEntry);
    const seen = Boolean(progressEntry && progressEntry.correctCount + progressEntry.wrongCount > 0);

    if (selectedExam !== "all" && question.examNumber !== Number(selectedExam)) {
      return false;
    }

    if (revealedQuestionId === question.id) {
      return true;
    }

    if (queueFilter === "unseen" && status !== "unseen") {
      return false;
    }

    if (queueFilter === "seen" && !seen) {
      return false;
    }

    if (queueFilter === "wrong" && status !== "wrong") {
      return false;
    }

    if (queueFilter === "review" && status !== "review") {
      return false;
    }

    if (queueFilter === "done" && status !== "done") {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = `${question.prompt} ${question.options.map((option) => option.text).join(" ")}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const currentQuestion = activeQuestions[cursor] ?? null;
  const examOptions = Array.from(new Set(questions.map((question) => question.examNumber))).sort(
    (left, right) => left - right
  );

  useEffect(() => {
    if (!questions.length || didInitializeCursor.current) {
      return;
    }

    const firstUnseenIndex = questions.findIndex((question) => getQuestionStatus(progress[question.id]) === "unseen");
    const restoredIndex = lastQuestionId ? questions.findIndex((question) => question.id === lastQuestionId) : -1;

    if (firstUnseenIndex >= 0) {
      setCursor(firstUnseenIndex);
    } else if (restoredIndex >= 0) {
      setCursor(restoredIndex);
    } else {
      setCursor(questions.length > 0 ? questions.length - 1 : 0);
    }

    didInitializeCursor.current = true;
  }, [questions, progress, lastQuestionId]);

  useEffect(() => {
    if (!activeQuestions.length) {
      setCursor(0);
      return;
    }

    if (cursor > activeQuestions.length - 1) {
      setCursor(activeQuestions.length - 1);
    }
  }, [activeQuestions, cursor]);

  useEffect(() => {
    setSelectedAnswers([]);
    setShowAnswer(false);
    setLastCheckCorrect(null);
    setRevealedQuestionId(null);
    if (currentQuestion?.id) {
      setLastQuestionId(currentQuestion.id);
    }
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (!questions.length) {
      return;
    }

    const studyState: StudyState = {
      progress,
      activity,
      lastQuestionId
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studyState));
  }, [progress, activity, lastQuestionId, questions.length]);

  function recordActivity(correct: boolean) {
    const dayKey = formatDayKey(new Date());
    setActivity((current) => {
      const day = current[dayKey] ?? { attempts: 0, correct: 0 };
      return {
        ...current,
        [dayKey]: {
          attempts: day.attempts + 1,
          correct: day.correct + (correct ? 1 : 0)
        }
      };
    });
  }

  function saveAttempt(question: Question, answers: string[]) {
    const correct = isAnswerCorrect(question, answers);
    setSelectedAnswers(answers);
    setShowAnswer(true);
    setLastCheckCorrect(correct);
    setRevealedQuestionId(question.id);
    recordActivity(correct);

    setProgress((current) => {
      const entry = current[question.id] ?? getEmptyProgressEntry();
      return {
        ...current,
        [question.id]: {
          ...entry,
          correctCount: entry.correctCount + (correct ? 1 : 0),
          wrongCount: entry.wrongCount + (correct ? 0 : 1),
          reviewLater: correct ? entry.reviewLater : true,
          lastResult: correct ? "correct" : "wrong",
          lastAnsweredAt: new Date().toISOString()
        }
      };
    });
  }

  function handleOptionPress(optionKey: string) {
    if (!currentQuestion || showAnswer) {
      return;
    }

    if (currentQuestion.multipleAnswer) {
      setSelectedAnswers((current) =>
        current.includes(optionKey) ? current.filter((value) => value !== optionKey) : [...current, optionKey]
      );
      return;
    }

    setSelectedAnswers([optionKey]);
  }

  function submitAnswer() {
    if (!currentQuestion || selectedAnswers.length === 0 || showAnswer) {
      return;
    }

    saveAttempt(currentQuestion, selectedAnswers);
  }

  function goToNextQuestion() {
    if (!activeQuestions.length) {
      return;
    }

    setCursor((current) => (current + 1) % activeQuestions.length);
  }

  function goToPreviousQuestion() {
    if (!activeQuestions.length) {
      return;
    }

    setCursor((current) => (current - 1 + activeQuestions.length) % activeQuestions.length);
  }

  function toggleReviewLater() {
    if (!currentQuestion) {
      return;
    }

    setProgress((current) => {
      const entry = current[currentQuestion.id] ?? getEmptyProgressEntry();
      return {
        ...current,
        [currentQuestion.id]: {
          ...entry,
          reviewLater: !entry.reviewLater
        }
      };
    });
  }

  function resetProgress() {
    if (!window.confirm("Reset all saved progress for this browser?")) {
      return;
    }

    setProgress({});
    setActivity({});
    setLastQuestionId(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async function shareProgress() {
    const studyState: StudyState = {
      progress,
      activity,
      lastQuestionId
    };
    const payload = JSON.stringify(buildExportPayload(studyState));

    if (!navigator.share) {
      await copyProgress();
      return;
    }

    try {
      await navigator.share({
        title: "AWS practice progress",
        text: payload
      });
      setTransferMessage("Progress shared.");
    } catch {
      setTransferMessage("");
    }
  }

  async function copyProgress() {
    try {
      const studyState: StudyState = {
        progress,
        activity,
        lastQuestionId
      };
      await navigator.clipboard.writeText(JSON.stringify(buildExportPayload(studyState)));
      setTransferMessage("Progress copied.");
    } catch {
      setTransferMessage("Could not copy progress.");
    }
  }

  async function importProgress(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const state = parseStoredState(await file.text());
      setProgress(state.progress);
      setActivity(state.activity);
      setLastQuestionId(state.lastQuestionId);
      setTransferMessage("Progress imported.");
    } catch {
      window.alert("That file is not valid progress JSON.");
    } finally {
      event.target.value = "";
    }
  }

  function importProgressFromPaste() {
    if (!pasteValue.trim()) {
      return;
    }

    try {
      const state = parseStoredState(pasteValue);
      setProgress(state.progress);
      setActivity(state.activity);
      setLastQuestionId(state.lastQuestionId);
      setPasteValue("");
      setTransferMessage("Progress imported.");
    } catch {
      window.alert("That pasted text is not valid progress JSON.");
    }
  }

  function getOptionClass(optionKey: string) {
    if (!currentQuestion) {
      return "option";
    }

    if (!showAnswer) {
      return selectedAnswers.includes(optionKey) ? "option selected" : "option";
    }

    const isCorrectOption = currentQuestion.correctAnswers.includes(optionKey);
    const isSelected = selectedAnswers.includes(optionKey);

    if (isCorrectOption) {
      return "option correct";
    }

    if (isSelected) {
      return "option wrong";
    }

    return "option";
  }

  if (isLoading) {
    return <main className="app-shell">Loading...</main>;
  }

  if (loadError) {
    return <main className="app-shell">{loadError}</main>;
  }

  if (!currentQuestion) {
    return (
      <main className="app-shell">
        <section className="question-card">
          <p>No questions match the current filters.</p>
        </section>
      </main>
    );
  }

  const currentProgress = progress[currentQuestion.id];
  const currentTags = getQuestionTags(currentProgress);
  const explanation = parseExplanation(currentQuestion.explanation);
  const answeredCount = Object.values(progress).filter((entry) => entry.lastResult !== null).length;
  const totalAttempts = Object.values(progress).reduce((sum, entry) => sum + entry.correctCount + entry.wrongCount, 0);
  const totalCorrect = Object.values(progress).reduce((sum, entry) => sum + entry.correctCount, 0);
  const totalReview = Object.values(progress).filter((entry) => getQuestionStatus(entry) === "review").length;
  const totalWrong = Object.values(progress).filter((entry) => getQuestionStatus(entry) === "wrong").length;
  const overallAccuracy = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const readinessThreshold = 70;
  const perExamStats = examOptions.map((examNumber) => {
    const examQuestions = questions.filter((question) => question.examNumber === examNumber);
    const examEntries = examQuestions
      .map((question) => progress[question.id])
      .filter((entry): entry is ProgressEntry => Boolean(entry));
    const attempts = examEntries.reduce((sum, entry) => sum + entry.correctCount + entry.wrongCount, 0);
    const correct = examEntries.reduce((sum, entry) => sum + entry.correctCount, 0);
    const answered = examEntries.filter((entry) => entry.lastResult !== null).length;
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;

    return {
      examNumber,
      accuracy,
      answered,
      status: accuracy >= readinessThreshold && attempts > 0 ? "Pass" : "Not pass"
    };
  });

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <div className="title">AWS Practice</div>
          <div className="meta">
            Exam {currentQuestion.examNumber} · Question {currentQuestion.questionNumber} · {cursor + 1} /{" "}
            {activeQuestions.length}
          </div>
        </div>
        <div className="nav-actions">
          <button className="nav-button nav-prev" type="button" onClick={goToPreviousQuestion}>
            <Icon name="left" />
            <span>Prev</span>
          </button>
          <button className="nav-button nav-next" type="button" onClick={goToNextQuestion}>
            <span>Next</span>
            <Icon name="right" />
          </button>
        </div>
      </header>

      <div className="panel-switcher">
        <button
          className={`switcher-button ${openPanel === "options" ? "active" : ""}`.trim()}
          type="button"
          onClick={() => setOpenPanel((current) => (current === "options" ? null : "options"))}
        >
          <Icon name="sliders" />
          <span>Options</span>
        </button>
        <button
          className={`switcher-button ${openPanel === "progress" ? "active" : ""}`.trim()}
          type="button"
          onClick={() => setOpenPanel((current) => (current === "progress" ? null : "progress"))}
        >
          <Icon name="chart" />
          <span>Progress</span>
        </button>
      </div>

      {openPanel === "options" ? (
        <section className="panel">
          <div className="panel-body">
            <label className="field">
              <span>Exam</span>
              <select value={selectedExam} onChange={(event) => setSelectedExam(event.target.value)}>
                <option value="all">All exams</option>
                {examOptions.map((examNumber) => (
                  <option key={examNumber} value={String(examNumber)}>
                    Exam {examNumber}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tag filter</span>
              <select value={queueFilter} onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}>
                <option value="all">All questions</option>
                <option value="unseen">New</option>
                <option value="seen">Seen</option>
                <option value="wrong">Wrong</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </label>

            <label className="field">
              <span>Search</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
              />
            </label>

            <div className="button-row">
              <button className="secondary-button" type="button" onClick={toggleReviewLater}>
                <Icon name="flag" />
                <span>{currentProgress?.reviewLater ? "Unmark review" : "Mark review"}</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => downloadProgress({ progress, activity, lastQuestionId })}>
                <Icon name="export" />
                <span>Export</span>
              </button>
              <button className="secondary-button" type="button" onClick={shareProgress}>
                <Icon name="share" />
                <span>Share</span>
              </button>
              <button className="secondary-button" type="button" onClick={copyProgress}>
                <Icon name="copy" />
                <span>Copy</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>
                <Icon name="import" />
                <span>Import</span>
              </button>
              <button className="secondary-button danger" type="button" onClick={resetProgress}>
                <Icon name="reset" />
                <span>Reset</span>
              </button>
              <input ref={importInputRef} hidden type="file" accept="application/json" onChange={importProgress} />
            </div>

            <label className="field">
              <span>Paste imported progress</span>
              <textarea
                rows={4}
                value={pasteValue}
                onChange={(event) => setPasteValue(event.target.value)}
                placeholder="Paste exported progress JSON"
              />
            </label>

            <div className="button-row">
              <button className="secondary-button" type="button" onClick={importProgressFromPaste}>
                Import pasted text
              </button>
            </div>

            {transferMessage ? <div className="small-note">{transferMessage}</div> : null}
          </div>
        </section>
      ) : null}

      {openPanel === "progress" ? (
        <section className="panel">
          <div className="panel-body">
            <div className="stats-grid">
              <div className="stat-block">
                <div className="stat-label">Accuracy</div>
                <div className="stat-value">{overallAccuracy}%</div>
              </div>
              <div className="stat-block">
                <div className="stat-label">Answered</div>
                <div className="stat-value">{answeredCount}</div>
              </div>
              <div className="stat-block">
                <div className="stat-label">Wrong</div>
                <div className="stat-value">{totalWrong}</div>
              </div>
              <div className="stat-block">
                <div className="stat-label">Review</div>
                <div className="stat-value">{totalReview}</div>
              </div>
            </div>

            <div className="readiness-note">
              Readiness threshold: {readinessThreshold}% · <strong>{overallAccuracy >= readinessThreshold ? "Pass" : "Not pass"}</strong>
            </div>

            <ProgressChart activity={activity} />

            <div className="exam-stats">
              {perExamStats.map((exam) => (
                <div key={exam.examNumber} className="exam-stat-row">
                  <div className="exam-stat-main">
                    <div className="exam-stat-title">Exam {exam.examNumber}</div>
                    <div className="exam-stat-meta">
                      {exam.accuracy}% · {exam.answered} answered
                    </div>
                  </div>
                  <div className={`exam-stat-badge ${exam.status === "Pass" ? "ready" : "not-ready"}`}>
                    {exam.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="question-card">
        <div className="tag-row">
          {currentTags.map((tag) => (
            <span key={tag.label} className={`tag tag-${tag.tone}`}>
              <Icon name={tag.icon} className="tag-icon" />
              {tag.label}
            </span>
          ))}
        </div>

        <p className="prompt">{currentQuestion.prompt}</p>

        <div className="options">
          {currentQuestion.options.map((option) => (
            <button
              key={option.key}
              className={getOptionClass(option.key)}
              type="button"
              onClick={() => handleOptionPress(option.key)}
            >
              <span className="option-key">{option.key}</span>
              <span className="option-text">{option.text}</span>
            </button>
          ))}
        </div>

        {!showAnswer ? (
          <div className="button-row question-actions">
            <button className="primary-button" type="button" onClick={submitAnswer} disabled={!selectedAnswers.length}>
              <Icon name="submit" />
              <span>Submit</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => setSelectedAnswers([])}>
              <Icon name="clear" />
              <span>Clear</span>
            </button>
          </div>
        ) : null}

        {showAnswer ? (
          <section className={`feedback ${lastCheckCorrect ? "success" : "error"}`}>
            <div className="feedback-title">{lastCheckCorrect ? "Correct" : "Incorrect"}</div>
            <div className="answer-line">
              Answer: {currentQuestion.correctAnswers.join(", ")}
              {selectedAnswers.length ? ` · You chose: ${selectedAnswers.join(", ")}` : ""}
            </div>
            <p className="explanation-text">{explanation.summary}</p>
            {explanation.otherOptions.length ? (
              <details className="subpanel">
                <summary>Other options</summary>
                <ul className="reason-list">
                  {explanation.otherOptions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {currentQuestion.reference ? (
              <a className="reference-link" href={currentQuestion.reference} target="_blank" rel="noreferrer">
                Reference
              </a>
            ) : null}
            <div className="button-row footer-nav">
              <button className="nav-button nav-prev" type="button" onClick={goToPreviousQuestion}>
                <Icon name="left" />
                <span>Prev</span>
              </button>
              <button className="nav-button nav-next" type="button" onClick={goToNextQuestion}>
                <span>Next</span>
                <Icon name="right" />
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
