export interface FlashcardCard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function extractJsonArrayCandidate(response: string): string {
  const trimmed = response.trim();
  if (!trimmed) {
    throw new Error("AI response was empty.");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const normalized = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const arrayMatch = normalized.match(/\[[\s\S]*\]/);

  return (arrayMatch ? arrayMatch[0] : normalized).trim();
}

/**
 * Parse an AI flashcard response into FlashcardCard objects.
 * Accepts both {front, back} and the alternative {question, answer} key layouts
 * that the model may emit depending on how the prompt was worded.
 */
export function parseFlashcardsResponse(response: string): FlashcardCard[] {
  const jsonCandidate = extractJsonArrayCandidate(response);
  const parsed = JSON.parse(jsonCandidate) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a flashcard array.");
  }

  const seenCards = new Set<string>();
  const cards = parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    // Accept both {front, back} and {question, answer} layouts.
    const front =
      (typeof entry.front === "string" ? entry.front.trim() : null) ??
      (typeof entry.question === "string" ? entry.question.trim() : "");
    const back =
      (typeof entry.back === "string" ? entry.back.trim() : null) ??
      (typeof entry.answer === "string" ? entry.answer.trim() : "");

    if (!front || !back) {
      return [];
    }

    const key = `${front}\u0000${back}`;
    if (seenCards.has(key)) {
      return [];
    }

    seenCards.add(key);
    return [{ front, back }];
  });

  if (cards.length === 0) {
    throw new Error("AI response did not include any valid flashcards.");
  }

  return cards;
}

/**
 * Parse an AI quiz response into QuizQuestion objects.
 * Strips optional markdown code fences and validates the required fields.
 */
export function parseQuizResponse(response: string): QuizQuestion[] {
  const jsonCandidate = extractJsonArrayCandidate(response);
  const parsed = JSON.parse(jsonCandidate) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a quiz array.");
  }

  const questions = parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const question = typeof entry.question === "string" ? entry.question.trim() : "";
    const correctIndex =
      typeof entry.correctIndex === "number" ? Math.floor(entry.correctIndex) : -1;
    const explanation = typeof entry.explanation === "string" ? entry.explanation.trim() : "";
    const options = Array.isArray(entry.options)
      ? (entry.options as unknown[]).filter((o): o is string => typeof o === "string")
      : [];

    if (!question || correctIndex < 0 || correctIndex >= options.length || options.length < 2) {
      return [];
    }

    return [{ question, options, correctIndex, explanation }];
  });

  if (questions.length === 0) {
    throw new Error("AI response did not include any valid quiz questions.");
  }

  return questions;
}
