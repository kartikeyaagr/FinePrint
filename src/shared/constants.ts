/**
 * Detection patterns, thresholds, and configuration constants.
 *
 * Pattern priority:
 *   URL patterns (0.9) > Text patterns (0.7) > Context heuristics (0.3)
 *   Combine for higher confidence: text + context = 0.85
 */

// ─── URL Patterns ───────────────────────────────────────────────────
// Match against link href. High confidence (0.9) — these are almost
// always T&C/privacy pages.

export const URL_PATTERNS: Array<{ regex: RegExp; type: string }> = [
  { regex: /\/(terms[-_]?(of[-_]?(service|use))?|tos)\b/i, type: "terms" },
  { regex: /\/(privacy[-_]?(policy|notice)?)\b/i, type: "privacy" },
  { regex: /\/(cookie[-_]?(policy|notice)?)\b/i, type: "cookies" },
  { regex: /\/eula\b/i, type: "eula" },
  { regex: /\/(legal[-_]?(terms|notice)?)\b/i, type: "terms" },
  { regex: /\/(acceptable[-_]?use[-_]?(policy)?)\b/i, type: "terms" },
  { regex: /\/(user[-_]?agreement)\b/i, type: "terms" },
  { regex: /\/(data[-_]?policy)\b/i, type: "privacy" },
];

export const URL_PATTERN_CONFIDENCE = 0.9;

// ─── Link Text Patterns ────────────────────────────────────────────
// Match against link innerText. Medium confidence (0.7).

export const TEXT_PATTERNS: Array<{ regex: RegExp; type: string }> = [
  // Multi-word (high confidence)
  { regex: /terms\s+(of\s+)?(service|use|conditions)/i, type: "terms" },
  { regex: /terms\s+and\s+conditions/i, type: "terms" },
  { regex: /conditions\s+of\s+use/i, type: "terms" },
  { regex: /privacy\s+(policy|notice|statement)/i, type: "privacy" },
  { regex: /cookie\s+(policy|notice|preferences|settings|use)/i, type: "cookies" },
  { regex: /user\s+agreement/i, type: "terms" },
  { regex: /end\s+user\s+license/i, type: "eula" },
  { regex: /data\s+(protection|processing)\s+(policy|agreement)/i, type: "privacy" },
  { regex: /acceptable\s+use\s+policy/i, type: "terms" },
  { regex: /copyright\s+policy/i, type: "terms" },
  { regex: /community\s+guidelines/i, type: "terms" },
  // Substring matches — links containing "privacy" or "terms" in longer text
  { regex: /privacy\s+(disclosure|choices|rights)/i, type: "privacy" },
  { regex: /data\s+privacy/i, type: "privacy" },
  // Single-word / short — reliable when they are the full link text
  { regex: /^privacy$/i, type: "privacy" },
  { regex: /^terms$/i, type: "terms" },
  { regex: /^legal$/i, type: "terms" },
  { regex: /^t\s*&\s*c'?s?$/i, type: "terms" },
  { regex: /^eula$/i, type: "eula" },
  { regex: /^cookie\s*policy$/i, type: "cookies" },
  { regex: /^data\s*policy$/i, type: "privacy" },
  { regex: /^cookies?$/i, type: "cookies" },
];

export const TEXT_PATTERN_CONFIDENCE = 0.7;

// ─── Consent Context Patterns ──────────────────────────────────────
// Detect "I agree" / "Accept" patterns near links. Low confidence
// alone (0.3), but boosts when combined with text matches.

export const CONSENT_PATTERNS: RegExp[] = [
  /i\s+(agree|accept|consent)\s+(to\s+)?(the\s+)?/i,
  /by\s+(continuing|signing|clicking|using)/i,
  /read\s+and\s+(agree|accept|understood)/i,
  /acknowledge\s+(that\s+)?(i\s+)?have\s+read/i,
];

export const CONTEXT_CONFIDENCE = 0.3;
export const CONTEXT_BOOST = 0.15; // Added when context corroborates text match

// ─── Detection Thresholds ──────────────────────────────────────────

export const MIN_CONFIDENCE = 0.5;
export const SCAN_DEBOUNCE_MS = 200;
export const MAX_LINKS_PER_PAGE = 20; // Don't process more than this

// ─── Red Flag Patterns ─────────────────────────────────────────────
// Scanned instantly against raw T&C text. No LLM needed.

export interface RedFlagPattern {
  name: string;
  regex: RegExp;
  severity: "warning" | "critical";
  description: string;
}

export const RED_FLAG_PATTERNS: RedFlagPattern[] = [
  {
    name: "Forced Arbitration",
    regex: /arbitrat(ion|e|ing)[\s\S]{0,200}(waiv(e|er|ing)|binding|mandatory)/i,
    severity: "critical",
    description:
      "You may be giving up your right to sue in court. Disputes would be resolved through private arbitration.",
  },
  {
    name: "Data Sale to Third Parties",
    regex: /(sell|sale|monetiz)[\s\S]{0,100}(data|information|personal)|third[\s-]?part(y|ies)[\s\S]{0,100}(share|transfer|disclose)[\s\S]{0,100}(data|information)/i,
    severity: "critical",
    description:
      "Your personal data may be sold or shared with third parties for profit.",
  },
  {
    name: "Class Action Waiver",
    regex: /class[\s-]?action[\s\S]{0,100}waiv(e|er|ing)/i,
    severity: "critical",
    description:
      "You may be giving up the right to join class action lawsuits against the company.",
  },
  {
    name: "Auto-Renewal Trap",
    regex: /auto(matic(ally)?)?[\s-]?renew[\s\S]{0,200}cancel[\s\S]{0,100}(before|prior|advance)/i,
    severity: "warning",
    description:
      "Subscription auto-renews and requires cancellation before renewal date to avoid charges.",
  },
  {
    name: "Unilateral Terms Changes",
    regex: /(modif|chang|updat|revis)(y|e|ing)[\s\S]{0,100}(terms|agreement|policy)[\s\S]{0,100}without[\s\S]{0,50}(notice|consent)/i,
    severity: "warning",
    description:
      "The company can change these terms at any time without notifying you.",
  },
  {
    name: "Broad Content License",
    regex: /(perpetual|irrevocable|worldwide|royalty[\s-]?free)[\s\S]{0,200}(license|right)[\s\S]{0,200}(content|material|submission)/i,
    severity: "warning",
    description:
      "You may be granting the company a very broad, permanent license to use content you create.",
  },
  {
    name: "No Refund Policy",
    regex: /(no[\s-]?refund|non[\s-]?refundable|all[\s-]?(sales|fees)[\s\S]{0,50}final)/i,
    severity: "warning",
    description:
      "Payments may be non-refundable under any circumstances.",
  },
  {
    name: "Indefinite Data Retention",
    regex: /retain[\s\S]{0,100}(data|information)[\s\S]{0,100}(indefinit|perpetual|no[\s\S]{0,20}limit)/i,
    severity: "warning",
    description:
      "Your data may be kept forever, even after you stop using the service.",
  },
  {
    name: "Law Enforcement Sharing",
    regex: /law[\s-]?enforcement[\s\S]{0,100}without[\s\S]{0,50}(warrant|judicial|court[\s-]?order)/i,
    severity: "critical",
    description:
      "Your data may be shared with law enforcement without requiring a warrant.",
  },
  {
    name: "Limitation of Liability",
    regex: /(not|no|shall not be)[\s\S]{0,50}(liable|responsib)[\s\S]{0,100}(indirect|consequential|incidental|special|punitive)/i,
    severity: "warning",
    description:
      "The company limits its financial liability, even if their service causes you harm.",
  },
];

// ─── LLM Configuration ─────────────────────────────────────────────

export const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";

export const MAX_INPUT_WORDS = 50_000;
export const MAX_INPUT_TOKENS_ESTIMATE = 70_000; // ~1.4 tokens per word
export const CHUNK_SIZE_WORDS = 15_000; // For chunked analysis of long docs

export const LLM_TIMEOUT_MS = 60_000; // 60 seconds
export const LLM_MAX_RETRIES = 2;

// ─── Cache ──────────────────────────────────────────────────────────

export const CACHE_DB_NAME = "term-reader-cache";
export const CACHE_DB_VERSION = 1;
export const CACHE_MAX_ENTRIES = 500;
export const CACHE_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// ─── Reading Time ───────────────────────────────────────────────────

export const WORDS_PER_MINUTE = 200; // Average adult reading speed
