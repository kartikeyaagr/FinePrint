<div align="center">
  <img src="../public/icons/icon-128.png" alt="FinePrint" width="72" />
  <h1>FinePrint — Design Document</h1>
  <p><em>Read the fine print. We already did.</em></p>
</div>

---

## Product Vision

**One-line:** A "nutrition label" for Terms & Conditions — instant, plain-English clarity on what you're agreeing to.

**User experience:** Visit any site → see a subtle shield icon next to T&C links → click for a beautiful, scannable summary with security score → never blindly accept terms again.

## V1 Feature Specifications

### 1. T&C Link Auto-Detection

**What:** Content script scans every page for links to Terms & Conditions, Privacy Policies, and similar legal documents.

**Detection strategy (layered, confidence-scored):**

```
Layer 1: URL pattern matching (high confidence)
  - /terms, /tos, /terms-of-service, /privacy, /privacy-policy
  - /legal, /eula, /cookie-policy, /acceptable-use
  - Regex: /(terms|privacy|legal|tos|eula|cookie.?policy)/i

Layer 2: Link text matching (medium confidence)
  - "Terms of Service", "Terms and Conditions", "Privacy Policy"
  - "Terms of Use", "User Agreement", "Cookie Policy"
  - "I agree to the...", "By continuing you accept..."

Layer 3: Context heuristics (low confidence, requires corroboration)
  - Checkbox near a link (consent pattern)
  - Link in footer (common T&C placement)
  - Link near "Sign Up" / "Register" / "Accept" buttons

Confidence threshold: ≥0.6 to show badge
  - Layer 1 match alone = 0.9
  - Layer 2 match alone = 0.7
  - Layer 3 match alone = 0.3 (not enough)
  - Layer 2 + Layer 3 = 0.85
```

**SPA handling:** MutationObserver watches for DOM changes. Re-scans on:

- New nodes added to document body
- URL hash/path changes (popstate event)
- Debounced to avoid performance impact (200ms)

### 2. Shield Badge Injection

**Visual design:**

```
  ┌──────────────────────────────────┐
  │  Terms of Service 🛡️             │  ← Shield badge appears inline
  └──────────────────────────────────┘     next to detected links

Badge states:
  🛡️ Gray    = Not yet analyzed
  🛡️ Green   = Low risk (score 8-10)
  🛡️ Yellow  = Medium risk (score 4-7)
  🛡️ Red     = High risk (score 1-3)
  🛡️ Spinning = Analysis in progress
```

**Implementation:** Injected via Shadow DOM to prevent CSS conflicts with host page.

### 3. Accept Prompt Overlay

**When:** Extension detects an "I agree" / "Accept" checkbox or button near T&C links.

**Overlay design:**

```
┌─────────────────────────────────────────────┐
│  📋 Want to understand what you're          │
│     agreeing to?                            │
│                                             │
│  This page has Terms & Conditions that      │
│  would take ~47 minutes to read.            │
│                                             │
│  [Read Summary]        [Dismiss]            │
└─────────────────────────────────────────────┘
```

**Behavior:**

- Appears once per domain per session (not annoying)
- Dismissal is remembered (chrome.storage.session)
- Non-blocking — user can still accept without reading

### 4. T&C Text Extraction

**Multi-format support:**

| Format      | Strategy                                           |
| ----------- | -------------------------------------------------- |
| HTML page   | Fetch URL, extract main content (readability-like) |
| PDF         | Lazy-load pdf.js, extract text per page            |
| Multi-page  | Follow "Next" / pagination links (max 20 pages)    |
| Iframe      | Fetch iframe src URL directly via service worker   |
| JS-rendered | Wait via MutationObserver, timeout after 10s       |

**Content normalization:**

- Strip HTML tags, normalize whitespace
- Preserve paragraph structure for LLM context
- Truncate at 50,000 words (with warning) — chosen to stay within Gemini 1.5 Flash's 1M-token context window while leaving room for the system prompt and response; ~50,000 words ≈ 65,000 tokens, well within all supported models
- Detect language for multi-language prompt support

### 5. LLM Analysis

**Provider abstraction:**

```typescript
interface LLMAdapter {
  analyze(text: string, prompt: string): Promise<AnalysisResult>;
  isConfigured(): boolean;
  getProviderName(): string;
}
```

**Prompt design (summary):**

```
You are a legal document analyzer. Analyze the following Terms & Conditions
and provide a structured summary.

Return a JSON object with this exact schema:
{
  "title": "Service name",
  "summary": "2-3 sentence plain-English overview",
  "readingTime": "estimated minutes to read original",
  "clauses": [
    {
      "category": "data_collection|data_sharing|user_rights|liability|
                   termination|auto_renewal|arbitration|content_rights|
                   privacy|cookies|other",
      "title": "Short clause title",
      "summary": "Plain-English explanation",
      "severity": "good|neutral|warning|critical",
      "originalExcerpt": "Relevant quote from the original text"
    }
  ],
  "worstClause": {
    "index": 0,
    "reason": "Why this is the most concerning clause"
  },
  "securityScore": {
    "overall": 7,
    "breakdown": {
      "dataCollection": 6,
      "dataSharing": 8,
      "userRights": 7,
      "liability": 5,
      "transparency": 9
    }
  }
}
```

### 6. Security Rating

**Scoring dimensions (1-10, 10 = best for user):**

| Dimension       | What it measures                                   |
| --------------- | -------------------------------------------------- |
| Data Collection | How much personal data is collected                |
| Data Sharing    | Whether data is sold/shared with third parties     |
| User Rights     | Can you delete data? Export? Object to processing? |
| Liability       | How much liability the company disclaims           |
| Transparency    | How clear and readable are the terms               |

**Overall score:** Weighted average — `(DataCollection×1 + DataSharing×2 + UserRights×1 + Liability×1 + Transparency×1) / 6`. Data Sharing is weighted 2× because it has the most direct impact on user privacy.

**Visual representation:**

```
┌─────────────────────────────────────┐
│  Security Score: 6.2 / 10  🟡      │
│  ▓▓▓▓▓▓░░░░                        │
│                                     │
│  Data Collection    ▓▓▓▓▓▓░░░░  6  │
│  Data Sharing       ▓▓▓▓▓▓▓▓░░  8  │
│  User Rights        ▓▓▓▓▓▓▓░░░  7  │
│  Liability          ▓▓▓▓▓░░░░░  5  │
│  Transparency       ▓▓▓▓▓▓▓▓▓░  9  │
└─────────────────────────────────────┘
```

### 7. Red Flag Pattern Library

**Instant detection (no LLM needed):**

| Pattern                 | Severity |
| ----------------------- | -------- |
| Forced arbitration      | Critical |
| Data sale               | Critical |
| Class action waiver     | Critical |
| Law enforcement sharing | Critical |
| Auto-renewal trap       | Warning  |
| Unilateral changes      | Warning  |
| Broad content license   | Warning  |
| No refund               | Warning  |
| Data retention          | Warning  |
| Liability limitation    | Neutral  |

```js
// Regex patterns (JavaScript syntax)
arbitrat(ion|e).*waiv(e|er|ing)                  // Forced arbitration
sell.*data|data.*sold|third\.part(y|ies).*share  // Data sale
class.action.*waiv                               // Class action waiver
law.enforcement.*without.*warrant                // Law enforcement sharing
auto.?renew.*cancel.*before                      // Auto-renewal trap
modify.*terms.*without.*notice                   // Unilateral changes
perpetual.*irrevocable.*license.*content         // Broad content license
no.?refund|non.?refundable                       // No refund
retain.*data.*indefinit                          // Data retention
not.*liable.*indirect|consequential              // Liability limitation
```

**Display:** Red flags shown immediately while LLM analysis loads.

### 8. T&C Version Diff Tracking

**Storage schema:**

```typescript
interface TCVersion {
  url: string;
  domain: string;
  contentHash: string; // SHA-256 of normalized text
  rawText: string; // Full T&C text
  fetchedAt: number; // Unix timestamp
  analysis?: AnalysisResult; // LLM analysis (if completed)
}
```

**Diff display:**

```
┌─────────────────────────────────────────┐
│  📋 Terms changed since Jan 15, 2026   │
│                                         │
│  + Added: "We may share anonymized      │
│    data with advertising partners"      │
│                                         │
│  ~ Changed: Data retention from         │
│    "2 years" to "indefinitely"          │
│                                         │
│  - Removed: "Users may request full     │
│    data deletion within 30 days"        │
│                                         │
│  ⚠ Security score changed: 7.1 → 5.4  │
└─────────────────────────────────────────┘
```

### 9. Reading Time Estimate

**Calculation:** `wordCount / 200` (average adult reading speed in WPM).

**Display:** "This T&C would take **47 minutes** to read. Here's the 2-minute version."

### 10. Worst Clause Spotlight

**Behavior:** From the LLM analysis, pick the clause with `severity: "critical"` and the lowest individual score. Display it prominently at the top of the summary.

```
┌─────────────────────────────────────────┐
│  ⚠ BIGGEST CONCERN                     │
│                                         │
│  "By using our service, you grant us    │
│   a perpetual, irrevocable license to   │
│   all content you create."              │
│                                         │
│  This means: The company owns your      │
│  content forever, even if you delete    │
│  your account.                          │
└─────────────────────────────────────────┘
```

## Side Panel Layout

```
┌─────────────────────────────────────────┐
│  🛡️ FinePrint          [⚙️ Settings] │
├─────────────────────────────────────────┤
│  example.com — Terms of Service         │
│  ⏱ 47 min read → 2 min summary         │
├─────────────────────────────────────────┤
│  Score: 6.2/10  🟡                      │
│  ▓▓▓▓▓▓░░░░                            │
├─────────────────────────────────────────┤
│  ⚠ BIGGEST CONCERN                     │
│  Perpetual content license...           │
├─────────────────────────────────────────┤
│  🚩 RED FLAGS (instant)                │
│  • Forced arbitration clause            │
│  • Class action waiver                  │
├─────────────────────────────────────────┤
│  📋 FULL SUMMARY                       │
│  ▸ Data Collection (6/10)              │
│  ▸ Data Sharing (8/10)                 │
│  ▸ User Rights (7/10)                  │
│  ▸ Liability (5/10)                    │
│  ▸ Transparency (9/10)                 │
├─────────────────────────────────────────┤
│  📊 CHANGES SINCE LAST VISIT           │
│  3 clauses changed on Feb 10, 2026     │
│  Score: 7.1 → 6.2 (↓0.9)              │
│  [View Changes]                         │
└─────────────────────────────────────────┘
```

## Message Passing Protocol

```
Content Script ──▶ Service Worker:
  { type: "TC_DETECTED", data: { url, linkText, confidence, tabId } }
  { type: "ANALYZE_REQUEST", data: { url, tabId } }

Service Worker ──▶ Content Script:
  { type: "BADGE_UPDATE", data: { url, status, score } }
  { type: "ANALYSIS_PROGRESS", data: { url, stage, progress } }

Service Worker ──▶ Side Panel:
  { type: "ANALYSIS_RESULT", data: { url, summary, rating, diff } }
  { type: "ANALYSIS_ERROR", data: { url, error, retryable } }

Side Panel ──▶ Service Worker:
  { type: "OPEN_ANALYSIS", data: { url } }
  { type: "RETRY_ANALYSIS", data: { url } }
  { type: "GET_SETTINGS" }
  { type: "SAVE_SETTINGS", data: { provider, apiKey, ... } }
```

## Storage Management

### IndexedDB Quota & Retention

| Concern             | Strategy                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Maximum size        | 50 MB soft cap with LRU eviction; Chrome may allow more but we self-limit                          |
| Eviction trigger    | On every write, if total stored size > 45 MB, delete oldest entries until < 40 MB                  |
| T&C version history | Keep at most 5 versions per URL; oldest deleted on next write for that URL                         |
| Analysis results    | Expire after 30 days; re-analysis required if user revisits                                        |
| Raw text            | Stored alongside analysis to enable diff; compressed with LZ-string (≈70% reduction on legal text) |

### `chrome.storage.local` Limits

Chrome enforces a 10 MB limit on `chrome.storage.local` (unless `unlimitedStorage` is requested — not needed here). FinePrint uses `chrome.storage.local` only for lightweight key–value data:

| Key                    | Max size (approx.)   |
| ---------------------- | -------------------- |
| API key                | <200 bytes           |
| Settings object        | <2 KB                |
| Overlay dismissal list | <5 KB (1000 domains) |
| Auth state             | <100 bytes           |

All large data (T&C text, analysis results, diffs) goes to IndexedDB, keeping `chrome.storage.local` well under 1 MB.

---

## Privacy & Security Design

### User Consent Model

- No data is sent anywhere until the user **explicitly clicks Analyze** (or the shield badge).
- The overlay prompt is informational only — the user can accept terms without ever using FinePrint.
- API key entry is voluntary; without a key the extension detects links but performs no analysis.

### API Key Security

| Risk                                 | Mitigation                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Key extracted from extension storage | `chrome.storage.local` is encrypted at rest by Chrome and inaccessible to other extensions           |
| Key visible in network traffic       | All API calls use HTTPS; key is passed as a header/query param (standard practice per provider docs) |
| Key accidentally logged              | No analytics, no crash reporting, no remote logging of any kind                                      |
| Key synced to cloud                  | Documented risk (Chrome Sync); user instructed to disable sync if concerned                          |

### Rate Limiting & LLM Fallback

- **Rate limit handling:** If the LLM API returns 429 (Too Many Requests), the error is surfaced with a "Retry" button and a human-readable message ("API rate limit reached — try again in a moment"). No automatic retry loop to avoid burning quota.
- **LLM fallback:** If the primary provider call fails with a non-retryable error (e.g., invalid key, model unavailable), the extension surfaces the red flags detected by the local regex scanner immediately and shows an error card prompting the user to check their API key in Settings.
- **Offline:** If `fetch` fails (no network), an "Offline" error state is shown with a Retry button. Cached results are still available.

---

## Permissions & Manifest

### Required Permissions

| Permission  | Justification                                                                   |
| ----------- | ------------------------------------------------------------------------------- |
| `activeTab` | Read the current tab's URL and inject content scripts on demand                 |
| `tabs`      | Query tab URLs for cache lookup; send messages to specific tabs                 |
| `storage`   | Persist API key, settings, and overlay dismissal list in `chrome.storage.local` |
| `sidePanel` | Programmatically open the side panel when a badge or overlay button is clicked  |

### Host Permissions

The extension uses `<all_urls>` in its content script `matches` field. This is required because legal documents can appear on any domain. The content script only performs lightweight DOM pattern matching — it does not read or transmit general page content.

### Manifest V3 Constraints

| Constraint                              | How FinePrint handles it                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| Service worker lifespan (~30s idle)     | Analysis is a single async operation; worker stays alive for its duration      |
| No persistent background page           | State is re-hydrated from `chrome.storage.local` on each activation            |
| Remote code forbidden                   | All code is bundled at build time; no `eval`, no remote scripts                |
| `declarativeNetRequest` vs `webRequest` | No request interception needed — extension fetches URLs directly via `fetch()` |
