/**
 * Main analysis orchestrator.
 *
 * Coordinates the full T&C analysis pipeline: cache check, text
 * extraction, red flag scanning, LLM analysis, diffing, and caching.
 */

import type {
  AnalysisResult,
  LLMConfig,
  TCDiff,
  TCVersion,
  AnalysisProgressData,
} from "../shared/types";
import { WORDS_PER_MINUTE } from "../shared/constants";
import { CacheManager } from "./cache";
import { extractText } from "./extractor";
import { scanRedFlags } from "./red-flags";
import { computeRating } from "./rating";
import { computeDiff, hashText } from "./diff";
import { createAdapter } from "./llm/adapter";

/** Analysis result bundled with optional diff against previous version. */
export interface AnalysisWithDiff {
  analysis: AnalysisResult;
  diff: TCDiff | null;
}

/** Maximum age of a cached analysis before re-analysis (7 days). */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Shared cache manager promise for singleton initialization. */
let cacheManagerPromise: Promise<CacheManager> | null = null;

/**
 * Get the shared cache manager, initializing it if needed.
 * Uses a promise-based singleton to prevent race conditions on concurrent calls.
 */
export async function getCache(): Promise<CacheManager> {
  if (!cacheManagerPromise) {
    cacheManagerPromise = (async () => {
      const manager = new CacheManager();
      await manager.init();
      return manager;
    })();
  }
  return cacheManagerPromise;
}

/**
 * Run the full T&C analysis pipeline for a URL.
 *
 * 1. Check cache — return early if analysis is recent (< 7 days)
 * 2. Extract text from the URL
 * 3. Scan for red flags (instant, no LLM needed)
 * 4. Send to LLM for full clause-by-clause analysis
 * 5. Merge red flags with LLM results
 * 6. Compute diff against previous version if one exists
 * 7. Cache the result
 *
 * @param url The URL of the T&C page to analyze.
 * @param config LLM configuration (provider, API key).
 * @param onProgress Optional callback for progress updates.
 */
export async function analyzeTC(
  url: string,
  config: LLMConfig,
  onProgress?: (progress: AnalysisProgressData) => void
): Promise<AnalysisWithDiff> {
  const cache = await getCache();
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL provided: ${url}`);
  }

  // ── Step 1: Check cache ──────────────────────────────────────────
  const cached = await cache.getAnalysis(url);
  if (cached && Date.now() - cached.analyzedAt < CACHE_MAX_AGE_MS) {
    return { analysis: cached, diff: null };
  }

  // ── Step 2: Extract text ─────────────────────────────────────────
  onProgress?.({
    url,
    stage: "extracting",
    progress: 0.1,
  });

  const extraction = await extractText(url);
  if (extraction.error) {
    throw new Error(`Text extraction failed: ${extraction.error}`);
  }
  if (!extraction.text || extraction.wordCount === 0) {
    throw new Error("No text content could be extracted from the page.");
  }

  // ── Step 3: Scan red flags ───────────────────────────────────────
  onProgress?.({
    url,
    stage: "scanning_flags",
    progress: 0.2,
  });

  const redFlags = scanRedFlags(extraction.text);

  // ── Step 4: LLM analysis ─────────────────────────────────────────
  onProgress?.({
    url,
    stage: "analyzing",
    progress: 0.3,
  });

  const adapter = createAdapter(config);
  if (!adapter.isConfigured()) {
    throw new Error(
      `${adapter.getProviderName()} API key is not configured. Please add it in the extension settings.`
    );
  }

  let analysis: AnalysisResult;
  try {
    analysis = await adapter.analyze(extraction.text, url);
  } catch (err) {
    throw new Error(
      `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Step 5: Merge red flags and compute rating ───────────────────
  onProgress?.({
    url,
    stage: "parsing",
    progress: 0.7,
  });

  // Merge red flags: combine LLM-detected flags with pattern-scanned ones
  const existingPatterns = new Set(analysis.redFlags.map((f) => f.pattern));
  for (const flag of redFlags) {
    if (!existingPatterns.has(flag.pattern)) {
      analysis.redFlags.push(flag);
    }
  }

  // Recompute security score from clauses
  analysis.securityScore = computeRating(analysis.clauses);
  analysis.wordCount = extraction.wordCount;
  analysis.readingTimeMinutes =
    analysis.readingTimeMinutes ||
    Math.ceil(extraction.wordCount / WORDS_PER_MINUTE);
  analysis.domain = domain;

  // ── Step 6: Compute diff ─────────────────────────────────────────
  let diff: TCDiff | null = null;
  const contentHash = await hashText(extraction.text);
  const previousVersion = await cache.getVersion(url);

  if (previousVersion && previousVersion.contentHash !== contentHash) {
    const diffResult = computeDiff(extraction.text, previousVersion.rawText);
    diff = {
      url,
      previousVersion: {
        fetchedAt: previousVersion.fetchedAt,
        contentHash: previousVersion.contentHash,
      },
      currentVersion: {
        fetchedAt: Date.now(),
        contentHash,
      },
      additions: diffResult.additions,
      removals: diffResult.removals,
      modifications: diffResult.modifications,
      scoreChange: previousVersion.analysis
        ? {
            before: previousVersion.analysis.securityScore.overall,
            after: analysis.securityScore.overall,
          }
        : null,
    };
  }

  // ── Step 7: Cache results ────────────────────────────────────────
  onProgress?.({
    url,
    stage: "caching",
    progress: 0.9,
  });

  const version: TCVersion = {
    url,
    domain,
    contentHash,
    rawText: extraction.text,
    fetchedAt: Date.now(),
    analysis,
  };

  await cache.saveVersion(version);
  await cache.saveAnalysis(analysis);

  return { analysis, diff };
}
