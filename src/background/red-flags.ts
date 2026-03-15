/**
 * Red flag scanner for T&C text.
 *
 * Scans raw text against known problematic patterns without
 * requiring LLM analysis. Results are available instantly.
 */

import { RED_FLAG_PATTERNS } from "../shared/constants";
import type { RedFlag } from "../shared/types";

/** Number of characters of context to include around each match. */
const SNIPPET_RADIUS = 100;

/**
 * Scan text for red flag patterns defined in constants.
 *
 * Returns deduplicated RedFlag entries, each with a ~200 character
 * snippet around the matched text.
 *
 * @param text The normalized T&C text to scan.
 */
export function scanRedFlags(text: string): RedFlag[] {
  const flags: RedFlag[] = [];
  const seenPatterns = new Set<string>();

  for (const pattern of RED_FLAG_PATTERNS) {
    // Skip if we already matched this pattern (deduplication)
    if (seenPatterns.has(pattern.name)) continue;

    const match = pattern.regex.exec(text);
    if (!match) continue;

    seenPatterns.add(pattern.name);

    // Extract a ~200 character snippet around the match
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const snippetStart = Math.max(0, matchStart - SNIPPET_RADIUS);
    const snippetEnd = Math.min(text.length, matchEnd + SNIPPET_RADIUS);

    let matchedText = text.slice(snippetStart, snippetEnd).trim();

    // Add ellipsis if we truncated
    if (snippetStart > 0) matchedText = "..." + matchedText;
    if (snippetEnd < text.length) matchedText = matchedText + "...";

    flags.push({
      pattern: pattern.name,
      severity: pattern.severity,
      matchedText,
      description: pattern.description,
    });
  }

  return flags;
}
