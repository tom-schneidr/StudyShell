export interface FlashcardCard {
  front: string;
  back: string;
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

export function parseFlashcardsResponse(response: string): FlashcardCard[] {
  const jsonCandidate = extractJsonArrayCandidate(response);
  const parsed = JSON.parse(jsonCandidate) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a flashcard array.");
  }

  const cards = parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const front = typeof entry.front === "string" ? entry.front.trim() : "";
    const back = typeof entry.back === "string" ? entry.back.trim() : "";

    if (!front || !back) {
      return [];
    }

    return [{ front, back }];
  });

  if (cards.length === 0) {
    throw new Error("AI response did not include any valid flashcards.");
  }

  return cards;
}
