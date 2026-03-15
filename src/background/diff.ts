/**
 * T&C version diffing and content hashing.
 *
 * Compares two versions of T&C text at the paragraph level to
 * identify additions, removals, and modifications. Uses SHA-256
 * via crypto.subtle for content hashing.
 */

/**
 * Result of comparing two T&C text versions.
 */
export interface DiffResult {
  additions: string[];
  removals: string[];
  modifications: Array<{ before: string; after: string }>;
}

/**
 * Compare two versions of T&C text at the paragraph level.
 *
 * Splits on double-newlines, normalizes whitespace before comparing,
 * and classifies each change as an addition, removal, or modification.
 *
 * @param currentText  The latest version of the text.
 * @param previousText The previous version of the text.
 */
export function computeDiff(
  currentText: string,
  previousText: string
): DiffResult {
  const currentParagraphs = splitParagraphs(currentText);
  const previousParagraphs = splitParagraphs(previousText);

  const currentNormalized = currentParagraphs.map(normalizeParagraph);
  const previousNormalized = previousParagraphs.map(normalizeParagraph);

  // Build a map from normalized text to list of indices for the previous version
  const prevMap = new Map<string, number[]>();
  for (let i = 0; i < previousNormalized.length; i++) {
    const norm = previousNormalized[i];
    const indices = prevMap.get(norm);
    if (indices) {
      indices.push(i);
    } else {
      prevMap.set(norm, [i]);
    }
  }

  const currentMap = new Map<string, number>();
  for (let i = 0; i < currentNormalized.length; i++) {
    if (!currentMap.has(currentNormalized[i])) {
      currentMap.set(currentNormalized[i], i);
    }
  }

  const additions: string[] = [];
  const removals: string[] = [];
  const modifications: Array<{ before: string; after: string }> = [];

  // Track which previous paragraphs have been matched
  const matchedPrev = new Set<number>();

  // For each current paragraph, check if it existed before
  for (let i = 0; i < currentNormalized.length; i++) {
    const normalized = currentNormalized[i];
    const prevIndices = prevMap.get(normalized);
    // Find the first unmatched previous index for this normalized text
    const unmatchedIdx = prevIndices?.find((idx) => !matchedPrev.has(idx));
    if (unmatchedIdx !== undefined) {
      matchedPrev.add(unmatchedIdx);
    } else {
      // Try to find a similar paragraph in previous (modification detection)
      const bestMatch = findBestMatch(
        normalized,
        previousNormalized,
        matchedPrev
      );
      if (bestMatch !== -1) {
        matchedPrev.add(bestMatch);
        modifications.push({
          before: previousParagraphs[bestMatch],
          after: currentParagraphs[i],
        });
      } else {
        additions.push(currentParagraphs[i]);
      }
    }
  }

  // Any unmatched previous paragraphs are removals
  for (let i = 0; i < previousNormalized.length; i++) {
    if (!matchedPrev.has(i) && !currentMap.has(previousNormalized[i])) {
      removals.push(previousParagraphs[i]);
    }
  }

  return { additions, removals, modifications };
}

/**
 * Compute a SHA-256 hash of the given text using crypto.subtle.
 *
 * @param text The text to hash.
 * @returns Hex-encoded SHA-256 hash string.
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Split text into paragraphs on double-newline boundaries. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Normalize a paragraph for comparison: lowercase, collapse whitespace. */
function normalizeParagraph(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Find the best matching paragraph in the previous text using a simple
 * similarity heuristic (shared word ratio). Returns the index of the
 * best match, or -1 if no match exceeds the similarity threshold.
 */
function findBestMatch(
  normalized: string,
  previousNormalized: string[],
  alreadyMatched: Set<number>
): number {
  const SIMILARITY_THRESHOLD = 0.5;
  const currentWords = new Set(normalized.split(" "));

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < previousNormalized.length; i++) {
    if (alreadyMatched.has(i)) continue;

    const prevWords = new Set(previousNormalized[i].split(" "));
    const totalWords = new Set([...currentWords, ...prevWords]);
    let shared = 0;
    for (const word of currentWords) {
      if (prevWords.has(word)) shared++;
    }

    const score = shared / totalWords.size;
    if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}
