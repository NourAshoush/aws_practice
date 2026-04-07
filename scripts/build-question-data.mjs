import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "practice-exams.md");
const publicDir = path.join(rootDir, "public");
const outputPath = path.join(publicDir, "questions.json");

function normalizeSource(source) {
  return source
    .replace(/\r\n?/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n+/, "")
    .replace(/\n\s*<details markdown=1><summary markdown='span'>Answer<\/summary>\n+/g, "\n\n")
    .replace(/\n\s*<details markdown=1><summary markdown='span'>Answer\s*\n+/g, "\n\n")
    .replace(/^(\s*)Why the other options are[^\n]*:/gm, "$1Other options:")
    .replace(/\n\s*<\/details>\n?/g, "\n");
}

function splitExamSections(source) {
  const examMatches = [...source.matchAll(/^# Practice Exam (\d+)\s*$/gm)];
  if (!examMatches.length) {
    throw new Error("No exam headings were found.");
  }

  return examMatches.map((match, index) => {
    const examNumber = Number(match[1]);
    const start = match.index + match[0].length;
    const end = examMatches[index + 1]?.index ?? source.length;
    const content = source.slice(start, end).trim();

    return { examNumber, content };
  });
}

function splitQuestionBlocks(section) {
  const matches = [...section.matchAll(/^(\d+)\.\s+/gm)];
  if (!matches.length) {
    return [];
  }

  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? section.length;
    return section.slice(start, end).trim();
  });
}

function compactParagraphs(lines) {
  const cleaned = [];
  let previousWasBlank = false;

  for (const line of lines) {
    const value = line.trimEnd();
    const isBlank = value.trim().length === 0;
    if (isBlank) {
      if (!previousWasBlank) {
        cleaned.push("");
      }
      previousWasBlank = true;
      continue;
    }

    cleaned.push(value.trimStart());
    previousWasBlank = false;
  }

  return cleaned.join("\n").trim();
}

function parseQuestionBlock(examNumber, block) {
  const lines = block.split("\n");
  const firstLine = lines.shift();

  if (!firstLine) {
    throw new Error(`Empty question block in exam ${examNumber}.`);
  }

  const questionMatch = firstLine.match(/^(\d+)\.\s*(.+)$/);
  if (!questionMatch) {
    throw new Error(`Could not parse question header in exam ${examNumber}: ${firstLine}`);
  }

  const questionNumber = Number(questionMatch[1]);
  const promptLines = [questionMatch[2].trim()];
  const options = [];
  const explanationLines = [];
  let answerLine = "";
  let reference = "";
  let inExplanation = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (trimmed === "---") {
      continue;
    }

    if (!answerLine) {
      const optionMatch = trimmed.match(/^-\s*([A-Z])\.\s*(.+)$/);
      if (optionMatch) {
        options.push({
          key: optionMatch[1],
          text: optionMatch[2].trim()
        });
        continue;
      }
    }

    const answerMatch = trimmed.match(/^Correct answer:\s*(.+)$/i);
    if (answerMatch) {
      answerLine = answerMatch[1].trim();
      inExplanation = false;
      continue;
    }

    if (/^Explanation:\s*$/i.test(trimmed)) {
      inExplanation = true;
      continue;
    }

    const referenceMatch = trimmed.match(/^Reference:\s*(.+)$/i);
    if (referenceMatch) {
      reference = referenceMatch[1].trim().replace(/^<|>$/g, "");
      inExplanation = false;
      continue;
    }

    if (inExplanation) {
      explanationLines.push(trimmed === "" ? "" : trimmed);
      continue;
    }

    if (!options.length && trimmed) {
      promptLines.push(trimmed);
    }
  }

  if (!options.length) {
    throw new Error(`Question ${examNumber}.${questionNumber} has no options.`);
  }

  if (!answerLine) {
    throw new Error(`Question ${examNumber}.${questionNumber} has no answer.`);
  }

  const correctAnswers = answerLine
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    id: `exam-${String(examNumber).padStart(2, "0")}-question-${String(questionNumber).padStart(2, "0")}`,
    examNumber,
    questionNumber,
    prompt: compactParagraphs(promptLines),
    options,
    correctAnswers,
    explanation: compactParagraphs(explanationLines),
    reference: reference || undefined,
    multipleAnswer: correctAnswers.length > 1
  };
}

async function main() {
  const rawSource = await readFile(sourcePath, "utf8");
  const source = normalizeSource(rawSource);
  const sections = splitExamSections(source);
  const questions = sections.flatMap(({ examNumber, content }) =>
    splitQuestionBlocks(content).map((block) => parseQuestionBlock(examNumber, block))
  );

  await mkdir(publicDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(questions, null, 2) + "\n");

  console.log(`Generated ${questions.length} questions from ${sections.length} exams.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
