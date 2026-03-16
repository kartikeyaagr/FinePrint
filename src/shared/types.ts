/**
 * Core types shared across content script, service worker, and UI.
 *
 * Type hierarchy:
 *   DetectedLink → AnalysisRequest → AnalysisResult
 *                                        ├── ClauseAnalysis[]
 *                                        ├── SecurityScore
 *                                        ├── WorstClause
 *                                        └── TCVersion (for diff)
 */

// ─── Detection ──────────────────────────────────────────────────────

export interface DetectedLink {
  url: string;
  linkText: string;
  confidence: number; // 0-1, threshold ≥0.6
  type: "terms" | "privacy" | "cookies" | "eula" | "other";
  element?: string; // CSS selector for the detected element
}

// ─── Analysis ───────────────────────────────────────────────────────

export type AnalysisStatus =
  | "idle"
  | "detected"
  | "extracting"
  | "analyzing"
  | "cached"
  | "error";

export type ClauseCategory =
  | "data_collection"
  | "data_sharing"
  | "user_rights"
  | "liability"
  | "termination"
  | "auto_renewal"
  | "arbitration"
  | "content_rights"
  | "privacy"
  | "cookies"
  | "other";

export type ClauseSeverity = "good" | "neutral" | "warning" | "critical";

export interface ClauseAnalysis {
  category: ClauseCategory;
  title: string;
  summary: string;
  severity: ClauseSeverity;
  originalExcerpt: string;
}

export interface SecurityScore {
  overall: number; // 1-10
  breakdown: {
    dataCollection: number;
    dataSharing: number;
    userRights: number;
    liability: number;
    transparency: number;
  };
}

export interface WorstClause {
  index: number; // Index into clauses array
  reason: string;
}

export interface AnalysisResult {
  url: string;
  domain: string;
  title: string;
  summary: string;
  readingTimeMinutes: number;
  wordCount: number;
  clauses: ClauseAnalysis[];
  worstClause: WorstClause | null;
  securityScore: SecurityScore;
  redFlags: RedFlag[];
  analyzedAt: number; // Unix timestamp
  provider: LLMProvider;
}

// ─── Red Flags ──────────────────────────────────────────────────────

export interface RedFlag {
  pattern: string; // Human-readable name
  severity: "warning" | "critical";
  matchedText: string; // The text that triggered the flag
  description: string; // Plain-English explanation
}

// ─── Diff Tracking ─────────────────────────────────────────────────

export interface TCVersion {
  url: string;
  domain: string;
  contentHash: string; // SHA-256 of normalized text
  rawText: string;
  fetchedAt: number;
  analysis?: AnalysisResult;
}

export interface TCDiff {
  url: string;
  previousVersion: { fetchedAt: number; contentHash: string };
  currentVersion: { fetchedAt: number; contentHash: string };
  additions: string[];
  removals: string[];
  modifications: Array<{ before: string; after: string }>;
  scoreChange: { before: number; after: number } | null;
}

// ─── LLM ────────────────────────────────────────────────────────────

export type LLMProvider = "gemini" | "claude";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string; // Optional model override
}

// ─── Message Passing ────────────────────────────────────────────────

export type MessageType =
  | "TC_DETECTED"
  | "ANALYZE_REQUEST"
  | "ANALYZE_ALL_REQUEST"
  | "MULTI_ANALYSIS_STARTED"
  | "BADGE_UPDATE"
  | "ANALYSIS_PROGRESS"
  | "ANALYSIS_RESULT"
  | "ANALYSIS_ERROR"
  | "DISMISS_OVERLAY"
  | "RETRY_ANALYSIS"
  | "GET_SETTINGS"
  | "SAVE_SETTINGS"
  | "GET_ANALYSIS"
  | "GET_DETECTED_LINKS"
  | "GET_AUTH_STATE";

export interface Message<T = unknown> {
  type: MessageType;
  data: T;
}

export interface TCDetectedData {
  links: DetectedLink[];
  tabId?: number;
  pageUrl: string;
}

export interface AnalyzeRequestData {
  url: string;
  tabId?: number;
}

export interface AnalyzeAllRequestData {
  links: DetectedLink[];
  tabId?: number;
}

export interface MultiAnalysisStartedData {
  links: DetectedLink[];
}

export interface BadgeUpdateData {
  url: string;
  status: AnalysisStatus;
  score?: number;
}

export interface AnalysisProgressData {
  url: string;
  stage: "extracting" | "scanning_flags" | "analyzing" | "parsing" | "caching";
  progress: number; // 0-1
}

export interface AnalysisErrorData {
  url: string;
  error: string;
  retryable: boolean;
}

// ─── Auth ───────────────────────────────────────────────────────────

export interface AuthState {
  signedIn: boolean;
  provider: LLMProvider | null;
  setupComplete: boolean; // Has user completed initial setup?
}

export const DEFAULT_AUTH_STATE: AuthState = {
  signedIn: false,
  provider: null,
  setupComplete: false,
};

// ─── Settings ───────────────────────────────────────────────────────

export interface Settings {
  llm: LLMConfig;
  notifications: {
    showOverlay: boolean; // Show "Want to understand?" prompt
    overlayDismissedDomains: string[]; // Domains where user dismissed
  };
  detection: {
    enabled: boolean;
    confidenceThreshold: number; // Default 0.6
  };
}

export const DEFAULT_SETTINGS: Settings = {
  llm: {
    provider: "gemini",
    apiKey: "",
  },
  notifications: {
    showOverlay: true,
    overlayDismissedDomains: [],
  },
  detection: {
    enabled: true,
    confidenceThreshold: 0.6,
  },
};
