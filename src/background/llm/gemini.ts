/**
 * Gemini API adapter for T&C analysis.
 *
 * Uses fetch() to call the Google Generative Language API directly.
 */

import {
  GEMINI_DEFAULT_MODEL,
  LLM_MAX_RETRIES,
  LLM_TIMEOUT_MS,
  WORDS_PER_MINUTE,
} from "../../shared/constants";
import type { AnalysisResult, LLMConfig } from "../../shared/types";
import type { LLMAdapter } from "./adapter";
import { buildAnalysisPrompt } from "./prompts";
import { parseAnalysisResponse, retryWithBackoff, NonRetryableError } from "./utils";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiAdapter implements LLMAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || GEMINI_DEFAULT_MODEL;
  }

  /** Analyze T&C text using the Gemini generateContent API. */
  async analyze(text: string, url: string): Promise<AnalysisResult> {
    if (!this.isConfigured()) {
      throw new Error("Gemini is not configured. Please add an API key in settings.");
    }

    const { system, user } = buildAnalysisPrompt(text, url);
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      throw new NonRetryableError(`Invalid URL provided for analysis: ${url}`);
    }

    const endpoint = `${GEMINI_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;

    const makeRequest = async (): Promise<AnalysisResult> => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        LLM_TIMEOUT_MS
      );

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: system }],
            },
            contents: [
              {
                parts: [{ text: user }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.1,
            },
          }),
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          throw new NonRetryableError(
            "Invalid Gemini API key. Please check your settings."
          );
        }

        if (response.status === 429) {
          throw new Error(
            "Rate limited by Gemini API. Please try again shortly."
          );
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(
            `Gemini API error (HTTP ${response.status}): ${body.slice(0, 200)}`
          );
        }

        const json = await response.json();
        const content =
          json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
          throw new Error("Empty response from Gemini API");
        }

        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const partial = parseAnalysisResponse(content);

        return {
          url,
          domain,
          title: partial.title,
          summary: partial.summary,
          readingTimeMinutes:
            partial.readingTimeMinutes ||
            Math.ceil(wordCount / WORDS_PER_MINUTE),
          wordCount,
          clauses: partial.clauses || [],
          worstClause: partial.worstClause ?? null,
          // securityScore is recomputed from clauses by computeRating() in analyzer.ts
          // after this adapter returns, so these placeholder values are always overwritten.
          securityScore: {
            overall: 5,
            breakdown: {
              dataCollection: 5,
              dataSharing: 5,
              userRights: 5,
              liability: 5,
              transparency: 5,
            },
          },
          // redFlags are populated by the regex scanner in analyzer.ts (scanRedFlags).
          // The LLM prompt intentionally does not request redFlags — the scanner handles them.
          redFlags: [],
          analyzedAt: Date.now(),
          provider: "gemini",
        };
      } finally {
        clearTimeout(timeout);
      }
    };

    return retryWithBackoff(makeRequest, LLM_MAX_RETRIES);
  }

  /** Whether API key is configured. */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /** Returns the provider name. */
  getProviderName(): string {
    return "Gemini";
  }
}
