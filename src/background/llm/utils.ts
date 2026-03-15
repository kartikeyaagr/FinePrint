/**
 * Shared utilities for LLM adapters: response parsing and retry logic.
 */

import type {
  ClauseAnalysis,
  WorstClause,
} from "../../shared/types";
/**
 * Error type that signals the request should not be retried
 * (e.g., invalid API key).
 */
export class NonRetryableError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * Partial analysis result parsed from LLM JSON output.
 */
export interface ParsedAnalysis {
  title: string;
  summary: string;
  readingTimeMinutes?: number;
  clauses: ClauseAnalysis[];
  worstClause: WorstClause | null;
}

/**
 * Parse the LLM's raw text response into a structured analysis.
 *
 * Handles cases where the LLM wraps JSON in markdown code blocks.
 * Validates the basic structure and provides sensible defaults.
 *
 * @param raw The raw text output from the LLM.
 * @throws Error if the response cannot be parsed as valid JSON.
 */
export function parseAnalysisResponse(raw: string): ParsedAnalysis {
  // Strip markdown code block wrappers if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse LLM response as JSON. Raw output: ${raw.slice(0, 300)}`
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("LLM response is not a JSON object");
  }

  return {
    title: String(parsed.title || "Untitled Document"),
    summary: String(parsed.summary || "No summary available."),
    readingTimeMinutes:
      typeof parsed.readingTimeMinutes === "number"
        ? parsed.readingTimeMinutes
        : undefined,
    clauses: Array.isArray(parsed.clauses)
      ? parsed.clauses.filter(
          (c): c is ClauseAnalysis =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as Record<string, unknown>).title === "string" &&
            typeof (c as Record<string, unknown>).summary === "string"
        )
      : [],
    worstClause:
      parsed.worstClause &&
      typeof parsed.worstClause === "object" &&
      typeof (parsed.worstClause as Record<string, unknown>).reason === "string"
        ? (parsed.worstClause as WorstClause)
        : null,
  };
}

/**
 * Retry a function with exponential backoff.
 *
 * Does not retry NonRetryableError (e.g., invalid API key).
 * Backoff starts at 1s and doubles each attempt.
 *
 * @param fn The async function to retry.
 * @param maxRetries Maximum number of retry attempts.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  const retries = Math.max(0, maxRetries);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry non-retryable errors
      if (err instanceof NonRetryableError) {
        throw err;
      }

      if (attempt < retries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error("retryWithBackoff: no attempts were made");
}
