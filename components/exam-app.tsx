"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/types/exam";

type ProgressEntry = {
  correctCount: number;
  wrongCount: number;
  manualFlag: boolean;
  lastResult: "correct" | "wrong" | null;
  lastAnsweredAt: string | null;
};

type ProgressMap = Record<string, ProgressEntry>;
type ActivityMap = Record<string, { attempts: number; correct: number }>;
type QueueFilter = "all" | "unseen" | "seen" | "wrong" | "review" | "done" | "flagged";
type PanelMode = "options" | "progress" | null;
type ViewMode = "overview" | "study";
type StudyScope = { kind: "all" } | { kind: "exam"; examNumber: number };
type StudyState = {
  progress: ProgressMap;
  activity: ActivityMap;
  lastQuestionId: string | null;
  lastScopeKey: string | null;
};

const STORAGE_KEY = "aws-practice-progress-v3";

function Icon({
  name,
  className = "icon"
}: {
  name:
    | "grid"
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
    | "done"
    | "play";
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
    case "grid":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      );
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
    case "play":
      return (
        <svg {...props}>
          <path d="M8 6l10 6-10 6V6z" />
        </svg>
      );
  }
}

function getEmptyProgressEntry(): ProgressEntry {
  return {
    correctCount: 0,
    wrongCount: 0,
    manualFlag: false,
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

function normalizeProgressEntry(value: unknown): ProgressEntry | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const correctCount = typeof value.correctCount === "number" ? value.correctCount : null;
  const wrongCount = typeof value.wrongCount === "number" ? value.wrongCount : null;
  const lastResult =
    value.lastResult === "correct" || value.lastResult === "wrong" || value.lastResult === null ? value.lastResult : null;
  const lastAnsweredAt = typeof value.lastAnsweredAt === "string" || value.lastAnsweredAt === null ? value.lastAnsweredAt : null;

  if (correctCount === null || wrongCount === null || lastResult === null && value.lastResult !== null || lastAnsweredAt === null && value.lastAnsweredAt !== null) {
    return null;
  }

  return {
    correctCount,
    wrongCount,
    manualFlag: typeof value.manualFlag === "boolean" ? value.manualFlag : false,
    lastResult,
    lastAnsweredAt
  };
}

function normalizeProgressMap(value: unknown): ProgressMap | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const entries = Object.entries(value).map(([key, entry]) => [key, normalizeProgressEntry(entry)] as const);
  if (entries.some(([, entry]) => !entry)) {
    return null;
  }

  return Object.fromEntries(entries) as ProgressMap;
}

function isActivityMap(value: unknown): value is ActivityMap {
  return (
    isObjectRecord(value) &&
    Object.values(value).every(
      (entry) => isObjectRecord(entry) && typeof entry.attempts === "number" && typeof entry.correct === "number"
    )
  );
}

function buildExportPayload(studyState: StudyState) {
  return {
    app: "aws-practice-progress",
    version: 3,
    exportedAt: new Date().toISOString(),
    ...studyState
  };
}

function parseStoredState(text: string): StudyState {
  const parsed = JSON.parse(text) as unknown;

  if (isObjectRecord(parsed) && "progress" in parsed) {
    const progress = normalizeProgressMap(parsed.progress);
    if (progress) {
      return {
        progress,
        activity: "activity" in parsed && isActivityMap(parsed.activity) ? parsed.activity : {},
        lastQuestionId: "lastQuestionId" in parsed && (typeof parsed.lastQuestionId === "string" || parsed.lastQuestionId === null)
          ? parsed.lastQuestionId
          : null,
        lastScopeKey: "lastScopeKey" in parsed && (typeof parsed.lastScopeKey === "string" || parsed.lastScopeKey === null)
          ? parsed.lastScopeKey
          : null
      };
    }
  }

  const progress = normalizeProgressMap(parsed);
  if (progress) {
    return {
      progress,
      activity: {},
      lastQuestionId: null,
      lastScopeKey: null
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

function getScopeKey(scope: StudyScope) {
  return scope.kind === "all" ? "all" : `exam-${scope.examNumber}`;
}

function getQuestionStatus(progressEntry: ProgressEntry | undefined) {
  if (!progressEntry || progressEntry.correctCount + progressEntry.wrongCount === 0) {
    return "unseen";
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

  if (progressEntry?.manualFlag) {
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
    return { x, y };
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
  const [lastScopeKey, setLastScopeKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [scope, setScope] = useState<StudyScope>({ kind: "all" });
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
  const [scopeSeed, setScopeSeed] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);

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
      const stored =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem("aws-practice-progress-v2") ??
        window.localStorage.getItem("aws-practice-progress-v1");
      if (!stored) {
        return;
      }

      const state = parseStoredState(stored);
      setProgress(state.progress);
      setActivity(state.activity);
      setLastQuestionId(state.lastQuestionId);
      setLastScopeKey(state.lastScopeKey);
    } catch {
      setProgress({});
      setActivity({});
      setLastQuestionId(null);
      setLastScopeKey(null);
    }
  }, []);

  useEffect(() => {
    if (!questions.length) {
      return;
    }

    const studyState: StudyState = {
      progress,
      activity,
      lastQuestionId,
      lastScopeKey
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studyState));
  }, [progress, activity, lastQuestionId, lastScopeKey, questions.length]);

  const examOptions = useMemo(
    () => Array.from(new Set(questions.map((question) => question.examNumber))).sort((left, right) => left - right),
    [questions]
  );

  const scopedQuestions = useMemo(() => {
    if (scope.kind === "all") {
      return questions;
    }

    return questions.filter((question) => question.examNumber === scope.examNumber);
  }, [questions, scope]);

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const activeQuestions = useMemo(() => {
    return scopedQuestions.filter((question) => {
      const progressEntry = progress[question.id];
      const status = getQuestionStatus(progressEntry);
      const seen = Boolean(progressEntry && progressEntry.correctCount + progressEntry.wrongCount > 0);

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

      if (queueFilter === "flagged" && !progressEntry?.manualFlag) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${question.prompt} ${question.options.map((option) => option.text).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [scopedQuestions, progress, queueFilter, normalizedSearch, revealedQuestionId]);

  const currentQuestion = activeQuestions[cursor] ?? null;

  useEffect(() => {
    if (viewMode !== "study") {
      return;
    }

    if (!scopedQuestions.length) {
      setCursor(0);
      return;
    }

    const visibleScopeKey = getScopeKey(scope);
    const restoredIndex =
      lastScopeKey === visibleScopeKey && lastQuestionId
        ? scopedQuestions.findIndex((question) => question.id === lastQuestionId)
        : -1;
    const firstUnseenIndex = scopedQuestions.findIndex((question) => getQuestionStatus(progress[question.id]) === "unseen");
    const nextIndex = restoredIndex >= 0 ? restoredIndex : firstUnseenIndex >= 0 ? firstUnseenIndex : 0;

    setCursor(nextIndex);
    setSelectedAnswers([]);
    setShowAnswer(false);
    setLastCheckCorrect(null);
    setRevealedQuestionId(null);
  }, [scopeSeed, scopedQuestions, progress, lastQuestionId, lastScopeKey, scope, viewMode]);

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
      setLastScopeKey(getScopeKey(scope));
    }
  }, [currentQuestion?.id, scope]);

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

  function toggleManualFlag() {
    if (!currentQuestion) {
      return;
    }

    setProgress((current) => {
      const entry = current[currentQuestion.id] ?? getEmptyProgressEntry();
      return {
        ...current,
        [currentQuestion.id]: {
          ...entry,
          manualFlag: !entry.manualFlag
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
    setLastScopeKey(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function openScope(nextScope: StudyScope) {
    setScope(nextScope);
    setViewMode("study");
    setQueueFilter("all");
    setSearch("");
    setOpenPanel(null);
    setScopeSeed((value) => value + 1);
  }

  async function shareProgress() {
    const studyState: StudyState = {
      progress,
      activity,
      lastQuestionId,
      lastScopeKey
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
        lastQuestionId,
        lastScopeKey
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
      setLastScopeKey(state.lastScopeKey);
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
      setLastScopeKey(state.lastScopeKey);
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

  function getScopeStats(scopeQuestions: Question[]) {
    const entries = scopeQuestions
      .map((question) => progress[question.id])
      .filter((entry): entry is ProgressEntry => Boolean(entry));
    const totalQuestions = scopeQuestions.length;
    const answered = entries.filter((entry) => entry.lastResult !== null).length;
    const wrong = entries.filter((entry) => getQuestionStatus(entry) === "wrong").length;
    const review = entries.filter((entry) => getQuestionStatus(entry) === "review").length;
    const done = entries.filter((entry) => getQuestionStatus(entry) === "done").length;
    const flagged = entries.filter((entry) => entry.manualFlag).length;
    const attempts = entries.reduce((sum, entry) => sum + entry.correctCount + entry.wrongCount, 0);
    const correct = entries.reduce((sum, entry) => sum + entry.correctCount, 0);
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;

    return {
      totalQuestions,
      answered,
      newCount: totalQuestions - answered,
      wrong,
      review,
      done,
      flagged,
      accuracy
    };
  }

  if (isLoading) {
    return <main className="app-shell">Loading...</main>;
  }

  if (loadError) {
    return <main className="app-shell">{loadError}</main>;
  }

  const allQuestionsStats = getScopeStats(questions);
  const currentProgress = currentQuestion ? progress[currentQuestion.id] : undefined;
  const currentTags = currentQuestion ? getQuestionTags(currentProgress) : [];
  const explanation = currentQuestion ? parseExplanation(currentQuestion.explanation) : { summary: "", otherOptions: [] };
  const totalAttempts = Object.values(progress).reduce((sum, entry) => sum + entry.correctCount + entry.wrongCount, 0);
  const totalCorrect = Object.values(progress).reduce((sum, entry) => sum + entry.correctCount, 0);
  const overallAccuracy = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const totalReview = Object.values(progress).filter((entry) => getQuestionStatus(entry) === "review").length;
  const totalWrong = Object.values(progress).filter((entry) => getQuestionStatus(entry) === "wrong").length;
  const readinessThreshold = 70;

  if (viewMode === "overview") {
    return (
      <main className="app-shell">
        <header className="overview-header">
          <div>
            <div className="title">AWS Practice</div>
            <div className="meta">Choose one exam or open the full bank.</div>
          </div>
        </header>

        <section className="overview-grid">
          <article className="exam-card exam-card-all">
            <div className="exam-card-head">
              <div>
                <div className="exam-card-title">All Questions</div>
                <div className="exam-card-subtitle">{allQuestionsStats.totalQuestions} questions total</div>
              </div>
              <button className="card-button" type="button" onClick={() => openScope({ kind: "all" })}>
                <Icon name="play" />
                <span>Open</span>
              </button>
            </div>
            <div className="exam-card-stats">
              <span>{allQuestionsStats.accuracy}% accuracy</span>
              <span>{allQuestionsStats.newCount} new</span>
              <span>{allQuestionsStats.review} review</span>
              <span>{allQuestionsStats.flagged} flagged</span>
            </div>
          </article>

          {examOptions.map((examNumber) => {
            const examQuestions = questions.filter((question) => question.examNumber === examNumber);
            const stats = getScopeStats(examQuestions);

            return (
              <article key={examNumber} className="exam-card">
                <div className="exam-card-head">
                  <div>
                    <div className="exam-card-title">Exam {examNumber}</div>
                    <div className="exam-card-subtitle">{stats.totalQuestions} questions</div>
                  </div>
                  <button className="card-button" type="button" onClick={() => openScope({ kind: "exam", examNumber })}>
                    <Icon name="play" />
                    <span>Open</span>
                  </button>
                </div>
                <div className="exam-card-stats">
                  <span>{stats.accuracy}% accuracy</span>
                  <span>{stats.newCount} new</span>
                  <span>{stats.review} review</span>
                  <span>{stats.flagged} flagged</span>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="app-shell">
        <header className="top-bar">
          <button className="nav-button back-button" type="button" onClick={() => setViewMode("overview")}>
            <Icon name="grid" />
            <span>Exams</span>
          </button>
        </header>

        <section className="question-card">
          <p>No questions match the current filters.</p>
        </section>
      </main>
    );
  }

  const scopeLabel = scope.kind === "all" ? "All Questions" : `Exam ${scope.examNumber}`;
  const scopeStats = getScopeStats(scopedQuestions);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="top-bar-main">
          <button className="nav-button back-button" type="button" onClick={() => setViewMode("overview")}>
            <Icon name="grid" />
            <span>Exams</span>
          </button>
          <div>
            <div className="title">{scopeLabel}</div>
            <div className="meta">
              Question {currentQuestion.questionNumber} · {cursor + 1} / {activeQuestions.length}
            </div>
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
              <span>Tag filter</span>
              <select value={queueFilter} onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}>
                <option value="all">All questions</option>
                <option value="unseen">New</option>
                <option value="seen">Seen</option>
                <option value="wrong">Wrong</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="flagged">Flagged</option>
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
              <button className="secondary-button" type="button" onClick={toggleManualFlag}>
                <Icon name="flag" />
                <span>{currentProgress?.manualFlag ? "Unflag" : "Flag"}</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => downloadProgress({ progress, activity, lastQuestionId, lastScopeKey })}
              >
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
                <Icon name="import" />
                <span>Import pasted text</span>
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
                <div className="stat-label">In this scope</div>
                <div className="stat-value">{scopeStats.answered}</div>
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
              Ready at {readinessThreshold}% accuracy. Current result:{" "}
              <strong>{overallAccuracy >= readinessThreshold ? "Pass" : "Not pass"}</strong>
            </div>

            <ProgressChart activity={activity} />

            <div className="exam-stats">
              <div className="exam-stat-row">
                <div className="exam-stat-main">
                  <div className="exam-stat-title">{scopeLabel}</div>
                  <div className="exam-stat-meta">
                    {scopeStats.accuracy}% · {scopeStats.newCount} new · {scopeStats.review} review · {scopeStats.flagged} flagged
                  </div>
                </div>
                <div className={`exam-stat-badge ${scopeStats.accuracy >= readinessThreshold && scopeStats.answered > 0 ? "ready" : "not-ready"}`}>
                  {scopeStats.accuracy >= readinessThreshold && scopeStats.answered > 0 ? "Pass" : "Not pass"}
                </div>
              </div>
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
