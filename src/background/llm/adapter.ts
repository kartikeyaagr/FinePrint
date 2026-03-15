/**
 * Common LLM adapter interface and factory.
 *
 * Provides a unified interface for LLM providers (currently Gemini),
 * with a factory function to instantiate the correct adapter
 * based on configuration.
 */

import type { AnalysisResult, LLMConfig } from "../../shared/types";
import { GeminiAdapter } from "./gemini";

/**
 * Common interface for LLM providers.
 *
 * All adapters implement retry logic with exponential backoff
 * (up to LLM_MAX_RETRIES attempts).
 */
export interface LLMAdapter {
  /** Analyze T&C text and return a structured result. */
  analyze(text: string, url: string): Promise<AnalysisResult>;

  /** Whether the adapter has a valid API key configured. */
  isConfigured(): boolean;

  /** Human-readable provider name. */
  getProviderName(): string;
}

/**
 * Create an LLM adapter based on the provided configuration.
 *
 * @param config LLM configuration with provider type and API key.
 * @returns The appropriate LLMAdapter implementation.
 * @throws Error if the provider type is unknown.
 */
export function createAdapter(config: LLMConfig): LLMAdapter {
  switch (config.provider) {
    case "gemini":
      return new GeminiAdapter(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
