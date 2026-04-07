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

type QueueFilter = "all" | "review" | "wrong" | "unseen";
type ImportPayload = {
  app?: string;
  version?: number;
  exportedAt?: string;
  progress?: ProgressMap;
};

const STORAGE_KEY = "aws-practice-progress-v1";

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
  if (!isObjectRecord(value)) {
    return false;
  }

  return Object.values(value).every((entry) => isProgressEntry(entry));
}

function buildExportPayload(progress: ProgressMap) {
  return {
    app: "aws-practice-progress",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress
  };
}

function parseImportedProgress(text: string) {
  const parsed = JSON.parse(text) as unknown;

  if (isObjectRecord(parsed) && "progress" in parsed && isProgressMap(parsed.progress)) {
    return parsed.progress;
  }

  if (isProgressMap(parsed)) {
    return parsed;
  }

  throw new Error("Invalid progress payload");
}

function downloadProgress(progress: ProgressMap) {
  const blob = new Blob([JSON.stringify(buildExportPayload(progress), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "aws-practice-progress.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function getQuestionStatus(progressEntry: ProgressEntry | undefined) {
  if (!progressEntry) {
    return "unseen";
  }

  if (progressEntry.reviewLater) {
    return "review";
  }

  if (progressEntry.lastResult === "wrong") {
    return "wrong";
  }

  return "answered";
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

export function ExamApp() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [selectedExam, setSelectedExam] = useState("all");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [cursor, setCursor] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastCheckCorrect, setLastCheckCorrect] = useState<boolean | null>(null);
  const [transferMessage, setTransferMessage] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgress(JSON.parse(stored) as ProgressMap);
      }
    } catch {
      setProgress({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const examOptions = Array.from(new Set(questions.map((question) => question.examNumber))).sort(
    (left, right) => left - right
  );

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const activeQuestions = questions.filter((question) => {
    if (selectedExam !== "all" && question.examNumber !== Number(selectedExam)) {
      return false;
    }

    if (queueFilter !== "all") {
      const status = getQuestionStatus(progress[question.id]);
      if (queueFilter === "review" && status !== "review") {
        return false;
      }
      if (queueFilter === "wrong" && status !== "wrong") {
        return false;
      }
      if (queueFilter === "unseen" && status !== "unseen") {
        return false;
      }
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = `${question.prompt} ${question.options.map((option) => option.text).join(" ")}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const currentQuestion = activeQuestions[cursor] ?? null;

  useEffect(() => {
    if (!activeQuestions.length) {
      setCursor(0);
      return;
    }

    if (cursor > activeQuestions.length - 1) {
      setCursor(0);
    }
  }, [activeQuestions, cursor]);

  useEffect(() => {
    setSelectedAnswers([]);
    setShowAnswer(false);
    setLastCheckCorrect(null);
  }, [currentQuestion?.id]);

  function saveAttempt(question: Question, answers: string[]) {
    const correct = isAnswerCorrect(question, answers);
    setSelectedAnswers(answers);
    setShowAnswer(true);
    setLastCheckCorrect(correct);

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
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async function shareProgress() {
    const payload = JSON.stringify(buildExportPayload(progress));

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
      await navigator.clipboard.writeText(JSON.stringify(buildExportPayload(progress)));
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
      setProgress(parseImportedProgress(await file.text()));
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
      setProgress(parseImportedProgress(pasteValue));
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
  const explanation = parseExplanation(currentQuestion.explanation);
  const answeredCount = Object.values(progress).filter((entry) => entry.lastResult !== null).length;
  const wrongCount = Object.values(progress).filter((entry) => entry.lastResult === "wrong").length;

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
            Prev
          </button>
          <button className="nav-button nav-next" type="button" onClick={goToNextQuestion}>
            Next
          </button>
        </div>
      </header>

      <details className="panel">
        <summary>Options</summary>
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
            <span>Queue</span>
            <select value={queueFilter} onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}>
              <option value="all">All questions</option>
              <option value="review">Review later</option>
              <option value="wrong">Wrong</option>
              <option value="unseen">Unseen</option>
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
              {currentProgress?.reviewLater ? "Unmark review" : "Mark review"}
            </button>
            <button className="secondary-button" type="button" onClick={() => downloadProgress(progress)}>
              Export
            </button>
            <button className="secondary-button" type="button" onClick={shareProgress}>
              Share
            </button>
            <button className="secondary-button" type="button" onClick={copyProgress}>
              Copy
            </button>
            <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>
              Import file
            </button>
            <button className="secondary-button danger" type="button" onClick={resetProgress}>
              Reset
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
      </details>

      <section className="question-card">
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
              Submit
            </button>
            <button className="secondary-button" type="button" onClick={() => setSelectedAnswers([])}>
              Clear
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
          </section>
        ) : null}
      </section>

      <details className="panel">
        <summary>Progress</summary>
        <div className="panel-body compact">
          <div>Answered: {answeredCount}</div>
          <div>Wrong: {wrongCount}</div>
          <div>Review: {Object.values(progress).filter((entry) => entry.reviewLater).length}</div>
        </div>
      </details>
    </main>
  );
}
