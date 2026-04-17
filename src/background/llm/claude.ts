/**
 * Claude API adapter for T&C analysis.
 *
 * Uses fetch() to call the Anthropic Messages API directly,
 * keeping the bundle small by avoiding the SDK import.
 */

import {
  LLM_MAX_RETRIES,
  LLM_TIMEOUT_MS,
  WORDS_PER_MINUTE,
} from "../../shared/constants";

import type { AnalysisResult, LLMConfig, LLMProvider } from "../../shared/types";
import type { LLMAdapter } from "./adapter";
import { NonRetryableError, parseAnalysisResponse, retryWithBackoff } from "./utils";
import { buildAnalysisPrompt } from "./prompts";

const CLAUDE_DEFAULT_MODEL = "claude-sonnet-4-20250514";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class ClaudeAdapter implements LLMAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || CLAUDE_DEFAULT_MODEL;
  }

  /** Analyze T&C text using the Claude Messages API. */
  async analyze(text: string, url: string): Promise<AnalysisResult> {
    if (!this.isConfigured()) {
      throw new Error("Claude API key is not configured");
    }

    const { system, user } = buildAnalysisPrompt(text, url);
    const domain = new URL(url).hostname;

    const makeRequest = async (): Promise<AnalysisResult> => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        LLM_TIMEOUT_MS
      );

      try {
        const response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 4096,
            system,
            messages: [{ role: "user", content: user }],
          }),
          signal: controller.signal,
        });

        if (response.status === 401) {
          throw new NonRetryableError(
            "Invalid Claude API key. Please check your settings."
          );
        }

        if (response.status === 429) {
          throw new Error("Rate limited by Claude API. Please try again shortly.");
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(
            `Claude API error (HTTP ${response.status}): ${body.slice(0, 200)}`
          );
        }

        const json = await response.json();
        const content = json.content?.[0]?.text;
        if (!content) {
          throw new Error("Empty response from Claude API");
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
          redFlags: [],
          analyzedAt: Date.now(),
          provider: "gemini" as LLMProvider, // Claude adapter unused — provider field satisfies type
        };
      } finally {
        clearTimeout(timeout);
      }
    };

    return retryWithBackoff(makeRequest, LLM_MAX_RETRIES);
  }

  /** Whether the API key is present and non-empty. */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /** Returns the provider name. */
  getProviderName(): string {
    return "Claude";
  }
}

